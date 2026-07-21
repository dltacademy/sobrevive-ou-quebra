// ============================================================
// Simulador de proteção — Monte Carlo de caminho de preço.
// Tudo roda no navegador; nenhum dado sai daqui.
//
// A pergunta que este motor responde não é "sua estratégia é boa?".
// É: você tem patrimônio exposto, teme uma queda, e existem quatro
// rotas possíveis. O que cada uma faz com o seu dinheiro no cenário
// ruim — e quanto ela custa no cenário bom?
//
// Rotas:
//   nada     — não fazer nada (linha de base)
//   reduzir  — vender parte da posição agora
//   futuros  — travar preço com uma posição vendida
//   seguro   — comprar uma opção de venda (perda limitada ao prêmio)
//
// O modelo NÃO prevê preço: a deriva é zero de propósito. Ele compara
// o formato das distribuições, que é o que distingue proteção de aposta.
// ============================================================

// Volatilidade anual por classe. Presets educacionais, não cotação.
const VOL_PRESETS = {
  cripto: 0.75,
  acoes: 0.30,
  cambio: 0.12,
};

const PASSOS_POR_MES = 21; // dias úteis aproximados

/**
 * Preço de referência de um seguro no preço de hoje, como fração do valor
 * coberto. Aproximação clássica do valor de uma opção no dinheiro:
 * ~0,4 · volatilidade · √prazo. Serve para ancorar a expectativa — a pessoa
 * substitui pelo prêmio real cotado na corretora.
 *
 * Sem essa âncora, um prêmio arbitrariamente baixo faz o simulador sugerir
 * que seguro dá lucro, o que não descreve nenhum mercado real.
 */
function premioReferencia(volPreset, meses) {
  const vol = VOL_PRESETS[volPreset] || VOL_PRESETS.cripto;
  const anos = meses / 12;
  return 0.4 * vol * Math.sqrt(anos);
}

// Normal padrão por Box-Muller. `rand` é injetável para teste determinístico.
function normalPadrao(rand) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Gera um caminho de preço relativo (começa em 1) sem deriva.
 * @returns {number[]} série de S_t / S_0, com length = passos + 1
 */
function gerarCaminho(passos, volAnual, rand) {
  const dt = 1 / (PASSOS_POR_MES * 12);
  const caminho = [1];
  let s = 1;
  for (let i = 0; i < passos; i++) {
    const z = normalPadrao(rand);
    s = s * Math.exp(-0.5 * volAnual * volAnual * dt + volAnual * Math.sqrt(dt) * z);
    caminho.push(s);
  }
  return caminho;
}

/**
 * Valor do patrimônio ao longo de um caminho, para uma rota.
 *
 * @param {number[]} caminho - série de S_t/S_0
 * @param {object} p - parâmetros já normalizados
 * @returns {{serie: number[], liquidada: boolean, liquidadaEm: number|null, custo: number}}
 */
function avaliarRota(caminho, p) {
  const { exposicao, cobertura, rota, alavancagemHedge, fundingAnual, premioPct, passos } = p;
  const dt = 1 / (PASSOS_POR_MES * 12);

  if (rota === "nada") {
    return { serie: caminho.map((s) => exposicao * s), liquidada: false, liquidadaEm: null, custo: 0 };
  }

  if (rota === "reduzir") {
    // Vende `cobertura` da posição agora; o que sobra continua exposto.
    const emCaixa = exposicao * cobertura;
    const exposto = exposicao * (1 - cobertura);
    return {
      serie: caminho.map((s) => exposto * s + emCaixa),
      liquidada: false,
      liquidadaEm: null,
      custo: 0,
    };
  }

  if (rota === "seguro") {
    // Opção de venda no preço de hoje. O prêmio é ENTRADA (lido na corretora),
    // não calculado aqui: a ferramenta mostra o que o prêmio faz com a
    // distribuição, não finge cotar a opção.
    const premio = exposicao * cobertura * premioPct;
    const serie = caminho.map((s) => {
      const spot = exposicao * s;
      const protecao = exposicao * cobertura * Math.max(0, 1 - s);
      return spot + protecao - premio;
    });
    return { serie, liquidada: false, liquidadaEm: null, custo: premio };
  }

  // rota === "futuros": posição vendida de nocional = exposicao * cobertura.
  // A margem é nocional / alavancagem. Se o preço SOBE o suficiente, a perda
  // da perna vendida consome a margem e a proteção é liquidada — a pessoa
  // fica descoberta justamente antes da queda que temia.
  const nocional = exposicao * cobertura;
  const margem = nocional / alavancagemHedge;
  const gatilhoLiquidacao = 1 + 1 / alavancagemHedge;

  const serie = [];
  let liquidadaEm = null;
  let sNaLiquidacao = null;
  let fundingAcumulado = 0;

  caminho.forEach((s, i) => {
    if (liquidadaEm === null) {
      if (i > 0) fundingAcumulado += nocional * fundingAnual * dt;
      if (s >= gatilhoLiquidacao) {
        liquidadaEm = i;
        sNaLiquidacao = s;
      }
    }

    const spot = exposicao * s;
    if (liquidadaEm === null) {
      const resultadoHedge = nocional * (1 - s);
      serie.push(spot + resultadoHedge - fundingAcumulado);
    } else {
      // proteção encerrada: perdeu a margem e segue exposta daí em diante
      serie.push(spot - margem - fundingAcumulado);
    }
  });

  return {
    serie,
    liquidada: liquidadaEm !== null,
    liquidadaEm,
    custo: fundingAcumulado + (liquidadaEm !== null ? margem : 0),
    sNaLiquidacao,
  };
}

/**
 * Roda a simulação completa comparando "não fazer nada" com a rota escolhida.
 *
 * @param {object} entrada
 *   exposicao      {number} valor exposto em R$
 *   meses          {number} horizonte
 *   volPreset      {'cripto'|'acoes'|'cambio'}
 *   cobertura      {number} 0..1 da posição protegida
 *   rota           {'nada'|'reduzir'|'futuros'|'seguro'}
 *   toleranciaPct  {number} 0..1 — quanto a pessoa aguenta perder
 *   alavancagemHedge {number}
 *   fundingAnual   {number} custo anual da perna vendida
 *   premioPct      {number} custo do seguro, fração da parte protegida
 *   simulacoes     {number}
 *   rand           {function} opcional, para teste determinístico
 */
function simularProtecao(entrada) {
  const p = {
    exposicao: entrada.exposicao,
    cobertura: entrada.cobertura,
    rota: entrada.rota,
    alavancagemHedge: entrada.alavancagemHedge || 2,
    fundingAnual: entrada.fundingAnual === undefined ? 0.10 : entrada.fundingAnual,
    premioPct: entrada.premioPct === undefined ? 0.05 : entrada.premioPct,
    passos: Math.max(1, Math.round(entrada.meses * PASSOS_POR_MES)),
  };
  const vol = VOL_PRESETS[entrada.volPreset] || VOL_PRESETS.cripto;
  const simulacoes = entrada.simulacoes || 1000;
  const rand = entrada.rand || Math.random;
  const limiteRuim = entrada.exposicao * (1 - entrada.toleranciaPct);

  let ruinsSem = 0;
  let ruinsCom = 0;
  let liquidacoes = 0;
  const finaisSem = [];
  const finaisCom = [];
  const amostras = [];
  const passoAmostra = Math.max(1, Math.floor(simulacoes / 40));

  for (let i = 0; i < simulacoes; i++) {
    const caminho = gerarCaminho(p.passos, vol, rand);
    const sem = avaliarRota(caminho, { ...p, rota: "nada" });
    const com = avaliarRota(caminho, p);

    const finalSem = sem.serie[sem.serie.length - 1];
    const finalCom = com.serie[com.serie.length - 1];
    finaisSem.push(finalSem);
    finaisCom.push(finalCom);
    if (finalSem < limiteRuim) ruinsSem++;
    if (finalCom < limiteRuim) ruinsCom++;
    if (com.liquidada) liquidacoes++;

    if (i % passoAmostra === 0 && amostras.length < 40) {
      amostras.push({ sem: sem.serie, com: com.serie, liquidada: com.liquidada });
    }
  }

  const mediana = (arr) => {
    const ordenado = [...arr].sort((a, b) => a - b);
    return ordenado[Math.floor(ordenado.length / 2)];
  };
  const media = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    simulacoes,
    limiteRuim,
    cenariosRuinsSemProtecao: ruinsSem / simulacoes,
    cenariosRuinsComProtecao: ruinsCom / simulacoes,
    medianaSem: mediana(finaisSem),
    medianaCom: mediana(finaisCom),
    // Quanto a proteção custou, em média, em relação a não fazer nada.
    // Negativo = a proteção tirou dinheiro (o preço de dormir tranquilo).
    diferencaMedia: media(finaisCom) - media(finaisSem),
    taxaLiquidacaoProtecao: p.rota === "futuros" ? liquidacoes / simulacoes : null,
    amostras,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { simularProtecao, avaliarRota, gerarCaminho, premioReferencia, VOL_PRESETS, PASSOS_POR_MES };
}
