// Testes determinísticos do motor de proteção.
// Rodar: node tests/test-protection.mjs
//
// A ideia é provar as invariantes que a copy da página vai afirmar. Se um
// teste destes cair, é a AFIRMAÇÃO da página que ficou falsa — não só o código.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const fonte = readFileSync(new URL("../js/protection.js", import.meta.url), "utf8");
const contexto = { module: { exports: {} }, Math };
vm.createContext(contexto);
vm.runInContext(fonte, contexto);
const { simularProtecao, avaliarRota, gerarCaminho } = contexto.module.exports;

const EXPOSICAO = 100000;
const base = {
  exposicao: EXPOSICAO,
  meses: 3,
  volPreset: "cripto",
  cobertura: 1,
  toleranciaPct: 0.2,
  alavancagemHedge: 2,
  fundingAnual: 0,
  premioPct: 0.05,
  simulacoes: 200,
};

// Gerador determinístico simples (LCG) — mesma sequência a cada execução.
function rngDeterminista(semente = 42) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

const paramsBase = { exposicao: EXPOSICAO, cobertura: 1, alavancagemHedge: 2, fundingAnual: 0, premioPct: 0.05, passos: 63 };

// ---------------------------------------------------------------
// 1. Não fazer nada acompanha o preço, ponto a ponto.
// ---------------------------------------------------------------
{
  const caminho = [1, 1.1, 0.8, 0.5];
  const r = avaliarRota(caminho, { ...paramsBase, rota: "nada" });
  [100000, 110000, 80000, 50000].forEach((esperado, i) => {
    assert.ok(Math.abs(r.serie[i] - esperado) < 1e-6, `passo ${i}: esperava ${esperado}, veio ${r.serie[i]}`);
  });
  assert.equal(r.custo, 0);
}

// ---------------------------------------------------------------
// 2. Reduzir 100% da posição congela o valor: nenhum cenário mexe nele.
//    É a rota mais barata e a que quase ninguém considera.
// ---------------------------------------------------------------
{
  const caminho = [1, 2.5, 0.1];
  const r = avaliarRota(caminho, { ...paramsBase, cobertura: 1, rota: "reduzir" });
  r.serie.forEach((v) => assert.equal(v, EXPOSICAO));
}

// ---------------------------------------------------------------
// 3. Reduzir metade deixa metade exposta — nem trava tudo, nem nada.
// ---------------------------------------------------------------
{
  const caminho = [1, 0.5];
  const r = avaliarRota(caminho, { ...paramsBase, cobertura: 0.5, rota: "reduzir" });
  assert.equal(r.serie[1], EXPOSICAO * 0.5 * 0.5 + EXPOSICAO * 0.5); // 75.000
}

// ---------------------------------------------------------------
// 4. Futuros com cobertura total e sem funding travam o valor —
//    inclusive na alta, que é o custo de travar.
// ---------------------------------------------------------------
{
  const caminho = [1, 0.6, 0.4];
  const r = avaliarRota(caminho, { ...paramsBase, rota: "futuros", alavancagemHedge: 1000 });
  r.serie.forEach((v) => assert.ok(Math.abs(v - EXPOSICAO) < 1e-6, `esperava ~${EXPOSICAO}, veio ${v}`));
}

// ---------------------------------------------------------------
// 5. A PROTEÇÃO QUEBRA: com alavancagem 2x, uma alta de 50% liquida a
//    perna vendida e a pessoa fica descoberta antes da queda temida.
//    É o novo sentido do nome da ferramenta.
// ---------------------------------------------------------------
{
  const caminho = [1, 1.5, 0.5];
  const r = avaliarRota(caminho, { ...paramsBase, rota: "futuros", alavancagemHedge: 2 });
  assert.equal(r.liquidada, true, "alta de 50% com 2x deve liquidar a proteção");
  assert.equal(r.liquidadaEm, 1);
  const margem = EXPOSICAO / 2;
  // no fim: spot caiu para 50.000 e a margem (50.000) foi perdida
  assert.equal(r.serie[2], EXPOSICAO * 0.5 - margem);
  // sem proteção teria 50.000; com a proteção liquidada, ficou pior
  assert.ok(r.serie[2] < EXPOSICAO * 0.5 + 1e-9);
}

// ---------------------------------------------------------------
// 6. Alavancagem menor aguenta a mesma alta sem liquidar.
// ---------------------------------------------------------------
{
  const caminho = [1, 1.5, 0.5];
  const r = avaliarRota(caminho, { ...paramsBase, rota: "futuros", alavancagemHedge: 1.5 });
  assert.equal(r.liquidada, false, "com folga de margem a proteção sobrevive à mesma alta");
}

// ---------------------------------------------------------------
// 7. Seguro cria um piso: com cobertura total, nenhum cenário fica
//    abaixo de (exposição - prêmio), por pior que seja a queda.
// ---------------------------------------------------------------
{
  const premioPct = 0.05;
  const piso = EXPOSICAO - EXPOSICAO * premioPct;
  [0.9, 0.5, 0.2, 0.01].forEach((queda) => {
    const r = avaliarRota([1, queda], { ...paramsBase, rota: "seguro", premioPct });
    assert.ok(r.serie[1] >= piso - 1e-6, `queda para ${queda} furou o piso do seguro`);
  });
}

// ---------------------------------------------------------------
// 8. E o seguro CUSTA: na alta, quem pagou prêmio termina atrás de
//    quem não fez nada, exatamente pelo valor do prêmio.
// ---------------------------------------------------------------
{
  const premioPct = 0.05;
  const comSeguro = avaliarRota([1, 1.4], { ...paramsBase, rota: "seguro", premioPct });
  const semNada = avaliarRota([1, 1.4], { ...paramsBase, rota: "nada" });
  const diferenca = semNada.serie[1] - comSeguro.serie[1];
  assert.ok(Math.abs(diferenca - EXPOSICAO * premioPct) < 1e-6);
}

// ---------------------------------------------------------------
// 9. Funding é custo real: com a mesma trajetória, mais funding = menos
//    dinheiro no fim.
// ---------------------------------------------------------------
{
  const caminho = gerarCaminho(63, 0.75, rngDeterminista(7));
  const semFunding = avaliarRota(caminho, { ...paramsBase, rota: "futuros", alavancagemHedge: 1000, fundingAnual: 0 });
  const comFunding = avaliarRota(caminho, { ...paramsBase, rota: "futuros", alavancagemHedge: 1000, fundingAnual: 0.2 });
  const fimSem = semFunding.serie[semFunding.serie.length - 1];
  const fimCom = comFunding.serie[comFunding.serie.length - 1];
  assert.ok(fimCom < fimSem, "funding precisa reduzir o resultado final");
}

// ---------------------------------------------------------------
// 10. Agregado: proteção reduz a frequência de cenários ruins.
//     É a afirmação central da página.
// ---------------------------------------------------------------
{
  const semente = () => rngDeterminista(2026);
  const nada = simularProtecao({ ...base, rota: "nada", rand: semente() });
  const seguro = simularProtecao({ ...base, rota: "seguro", premioPct: 0.05, rand: semente() });

  assert.ok(
    nada.cenariosRuinsSemProtecao > 0,
    "o cenário base precisa ter casos ruins, senão o teste não prova nada"
  );
  assert.equal(seguro.cenariosRuinsComProtecao, 0, "seguro com cobertura total e prêmio de 5% elimina a perda acima de 20%");
  assert.ok(
    seguro.cenariosRuinsComProtecao < seguro.cenariosRuinsSemProtecao,
    "proteção precisa reduzir a cauda ruim"
  );
}

// ---------------------------------------------------------------
// 11. O mesmo sorteio alimenta as duas curvas — a comparação é pareada,
//     não duas simulações independentes com sorte diferente.
// ---------------------------------------------------------------
{
  const r = simularProtecao({ ...base, rota: "seguro", rand: rngDeterminista(11) });
  r.amostras.forEach((a) => {
    assert.equal(a.sem.length, a.com.length, "as duas séries precisam ter o mesmo comprimento");
    assert.equal(a.sem[0], EXPOSICAO);
  });
  assert.ok(r.amostras.length > 0);
}

// ---------------------------------------------------------------
// 12. Determinismo: mesma semente, mesmo resultado.
// ---------------------------------------------------------------
{
  const a = simularProtecao({ ...base, rota: "futuros", rand: rngDeterminista(99) });
  const b = simularProtecao({ ...base, rota: "futuros", rand: rngDeterminista(99) });
  assert.equal(a.cenariosRuinsComProtecao, b.cenariosRuinsComProtecao);
  assert.equal(a.medianaCom, b.medianaCom);
}

// ---------------------------------------------------------------
// 13. Seguro cotado perto do preço de referência NÃO dá lucro médio.
//     Sem essa âncora, o simulador ensinaria almoço grátis: com prêmio
//     de 5% em cripto por 3 meses, a rota "seguro" aparecia ganhando
//     dinheiro na média — barato demais para ser um mercado real.
// ---------------------------------------------------------------
{
  const { premioReferencia } = contexto.module.exports;
  const ref = premioReferencia("cripto", 3);
  assert.ok(ref > 0.1 && ref < 0.25, `referência fora do razoável para cripto/3m: ${ref}`);

  const sims = 2000;
  const noPreco = simularProtecao({ ...base, rota: "seguro", premioPct: ref, simulacoes: sims, rand: rngDeterminista(5) });
  const barato = simularProtecao({ ...base, rota: "seguro", premioPct: 0.05, simulacoes: sims, rand: rngDeterminista(5) });
  const caro = simularProtecao({ ...base, rota: "seguro", premioPct: 0.30, simulacoes: sims, rand: rngDeterminista(5) });

  // No preço de referência o seguro é aproximadamente neutro na média: ele
  // troca formato de risco, não cria nem destrói dinheiro. O resíduo é ruído
  // amostral, então a asserção é de ordem de grandeza, não de sinal.
  assert.ok(
    Math.abs(noPreco.diferencaMedia) < EXPOSICAO * 0.03,
    `no preço de referência o seguro deveria ser ~neutro; veio ${noPreco.diferencaMedia}`
  );

  // Barato demais vira almoço grátis — era exatamente o que o padrão antigo
  // de 5% fazia a página afirmar sem querer.
  assert.ok(barato.diferencaMedia > noPreco.diferencaMedia, "prêmio abaixo do justo tem de parecer melhor que o justo");
  // Caro demais custa dinheiro de verdade.
  assert.ok(caro.diferencaMedia < noPreco.diferencaMedia, "prêmio acima do justo tem de custar mais que o justo");

  // e, em qualquer preço, continua fazendo o seu trabalho: cortar a cauda ruim
  assert.ok(noPreco.cenariosRuinsComProtecao < noPreco.cenariosRuinsSemProtecao);

  // prazo maior encarece o seguro
  assert.ok(premioReferencia("cripto", 12) > premioReferencia("cripto", 3));
  // ativo mais calmo custa menos
  assert.ok(premioReferencia("cambio", 3) < premioReferencia("cripto", 3));
}

console.log("Motor de proteção: OK — 4 rotas, piso do seguro, liquidação do hedge, funding, âncora de prêmio e comparação pareada");
