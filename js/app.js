// ============================================================
// Wiring da UI — conecta sliders/upload aos módulos de cálculo.
// ============================================================


function track(eventName) {
  if (window.goatcounter && window.goatcounter.count) {
    const channel = getChannel() || "direto";
    const variant = getVariant();
    window.goatcounter.count({
      path: `${eventName}?c=${encodeURIComponent(channel)}&v=${encodeURIComponent(variant)}`,
      event: true,
    });
  }
}

// ---------- Headline A/B (?v=a|b) ----------
function applyVariant() {
  const v = getVariant();
  if (v === "b") {
    document.getElementById("headline").innerHTML =
      'Quanto custa <span class="highlight">dormir tranquilo</span> com a sua posição?';
    document.getElementById("subheadline").textContent =
      "Compare não fazer nada, reduzir, travar com futuros e comprar seguro — nos mesmos 1.000 cenários, sem cadastro e sem instalar nada.";
  }
}

// ---------- Links de conversão (ref + telegram) ----------
function wireConversionLinks() {
  const ref = getRefLink();
  const directBinance = document.getElementById("cta-ref-sim");
  if (directBinance) directBinance.href = ref;
  if (directBinance) {
    directBinance.addEventListener("click", () => track("clique_oferta_binance_direto"));
  }
  document.querySelectorAll(".js-open-router").forEach((el) =>
    el.addEventListener("click", () => track("abriu_roteador"))
  );
}

// ============================================================
// ROTEADOR — uma recomendação principal conforme contexto
// ============================================================
const routerState = { hasBinance: null, goal: null };

const ROUTER_OFFERS = {
  binance: {
    title: "Binance com cashback vitalício no Spot",
    cta: "Abrir com o código BOSS2026 →",
    points: [
      "Cashback vitalício nas taxas elegíveis de Spot ativado pelo link de indicação",
      "Boa porta de entrada para spot e, depois de entender os riscos, futuros",
      "Código de referência: BOSS2026",
    ],
    note: "Válido para conta nova elegível. Confirme o cashback de Spot exibido na tela de cadastro. Não presumimos que o mesmo percentual cubra Futures; o benefício acompanha as regras vigentes do programa de indicação.",
  },
  bybit: {
    title: "Bybit com bônus para novos usuários elegíveis",
    cta: "Conhecer a Bybit →",
    points: [
      "O convite pode oferecer bônus de US$20 após cadastro e verificação de identidade",
      "Alternativa ampla para spot, derivativos, pagamentos e cartão",
      "Código de referência: O0YDQDM",
    ],
    note: "Bônus observado na página do convite em 17/07/2026 e sujeito a região, prazo e elegibilidade. Confira o valor, o KYC, as tarefas e as condições exibidas no seu cadastro.",
  },
  etherfi: {
    title: "ether.fi Cash para gastos e viagens",
    cta: "Ver a oferta do ether.fi Cash →",
    points: [
      "Cartão focado em gastar stablecoins e cripto no dia a dia",
      "Cashback pode chegar a 3% conforme tier, promoção, gasto e transação elegível",
      "O convite pode exibir até 15% em supermercado e restaurantes, sujeito às condições da campanha",
      "Comece o cadastro no navegador pelo link; instale o app somente depois",
    ],
    note: "Os percentuais são limites máximos, não garantia para toda compra. O fluxo navegador → cadastro → aplicativo é importante para a atribuição; confira cashback, categorias, prazo, FX, taxas, limites e elegibilidade.",
  },
  okx: {
    title: "Cartão OKX Brasil",
    cta: "Ver a oferta da OKX →",
    points: [
      "O convite pode oferecer até R$1.000 ao começar a negociar, conforme tarefas e elegibilidade",
      "Cartão virtual conectado ao saldo em USD do OKX Pay",
      "A tabela atual do produto brasileiro informa IOF zero e sem anuidade",
      "Código de referência: 30985036",
    ],
    note: "R$1.000 é o limite anunciado da campanha, não recompensa garantida. Confira tarefas, prazo e elegibilidade. No cartão brasileiro, câmbio fora de USD usa a taxa da Mastercard; condições podem mudar.",
  },
  kucoin: {
    title: "KuCoin",
    cta: "Conhecer a KuCoin →",
    points: [
      "Alternativa secundária para spot e futuros",
      "Pode fazer sentido para quem já usa as opções principais",
      "Código de referência: QBSD5WP6",
    ],
    note: "Disponibilidade, comissão e benefícios dependem do país e dos termos atuais.",
  },
  mexc: {
    title: "MEXC",
    cta: "Conhecer a MEXC →",
    points: [
      "Alternativa secundária para ampliar o catálogo de ativos",
      "KYC, recursos e limites variam por jurisdição",
    ],
    note: "Não conte com acesso sem KYC: confirme os requisitos atuais e a disponibilidade regional antes do cadastro.",
  },
};

function selectRouterOffer() {
  if (!routerState.hasBinance || !routerState.goal) return null;
  if (routerState.goal === "spend") {
    return { primary: "etherfi", alternatives: ["okx"] };
  }
  if (routerState.hasBinance === "no") {
    return { primary: "binance", alternatives: ["bybit"] };
  }
  return { primary: "bybit", alternatives: ["kucoin", "mexc", "okx"] };
}

function renderRouter() {
  const selection = selectRouterOffer();
  const pending = document.getElementById("router-pending");
  const result = document.getElementById("router-result");
  if (!selection) {
    pending.hidden = false;
    result.hidden = true;
    return;
  }

  const offer = ROUTER_OFFERS[selection.primary];
  pending.hidden = true;
  result.hidden = false;
  result.dataset.offer = selection.primary;
  document.getElementById("router-offer-name").textContent = offer.title;
  document.getElementById("router-offer-reason").textContent = buildRouterReason(selection.primary);
  document.getElementById("router-offer-note").textContent = offer.note;

  const points = document.getElementById("router-offer-points");
  points.innerHTML = "";
  offer.points.forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    points.appendChild(li);
  });

  const cta = document.getElementById("router-offer-cta");
  cta.href = getOfferLink(selection.primary);
  cta.textContent = offer.cta;
  cta.dataset.offer = selection.primary;
  renderRouterAlternatives(selection.alternatives);
  track(`roteador_resultado_${selection.primary}`);
}

function buildRouterReason(primary) {
  if (primary === "binance") {
    return "Você ainda não tem Binance e quer resolver uma necessidade ligada a trading. Aqui o benefício de conta nova ainda pode ser ativado; começar por outra indicação agora só aumentaria a complexidade.";
  }
  if (primary === "etherfi") {
    return "Seu objetivo principal é gastar cripto e reduzir atrito em viagens. Por isso, um cartão especializado é mais coerente do que abrir outra corretora apenas para trading.";
  }
  return "Como você já tem Binance, não faz sentido prometer um benefício de novo usuário nela. A Bybit é a alternativa principal pelo conjunto de recursos e pelo programa de indicação.";
}

function renderRouterAlternatives(keys) {
  const details = document.getElementById("router-alternatives");
  const list = document.getElementById("router-alternative-list");
  list.innerHTML = "";
  details.hidden = keys.length === 0;
  keys.forEach((key) => {
    const offer = ROUTER_OFFERS[key];
    const card = document.createElement("article");
    card.className = "alternative-card";
    const title = document.createElement("h4");
    title.textContent = offer.title;
    const text = document.createElement("p");
    text.textContent = offer.points[0];
    const link = document.createElement("a");
    link.className = "alternative-link";
    link.href = getOfferLink(key);
    link.target = "_blank";
    link.rel = "sponsored nofollow noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    link.dataset.offer = key;
    link.textContent = "Ver condições →";
    link.addEventListener("click", () => track(`clique_oferta_${key}_alternativa`));
    card.append(title, text, link);
    list.appendChild(card);
  });
}

function resetRouter() {
  routerState.hasBinance = null;
  routerState.goal = null;
  document.querySelectorAll("[data-router-field]").forEach((button) => {
    button.classList.remove("selected");
    button.setAttribute("aria-pressed", "false");
  });
  document.getElementById("router-alternatives").open = false;
  renderRouter();
  track("roteador_reset");
}

document.querySelectorAll("[data-router-field]").forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    const field = button.dataset.routerField;
    const value = button.dataset.value;
    routerState[field] = value;
    document.querySelectorAll(`[data-router-field="${field}"]`).forEach((peer) => {
      const selected = peer === button;
      peer.classList.toggle("selected", selected);
      peer.setAttribute("aria-pressed", String(selected));
    });
    track(`roteador_resposta_${field}_${value}`);
    renderRouter();
  });
});

document.getElementById("router-offer-cta").addEventListener("click", (event) => {
  const offer = event.currentTarget.dataset.offer || "desconhecida";
  track(`clique_oferta_${offer}_principal`);
});
document.getElementById("router-reset").addEventListener("click", resetRouter);

// ============================================================
// BENEFÍCIO TEMPORÁRIO — contato liberado após dados mínimos
// ============================================================
function initReferralBenefit() {
  const section = document.getElementById("beneficio-indicado");
  if (!section) return;
  if (!isTelegramConfigured()) {
    section.hidden = true;
    return;
  }

  const start = document.getElementById("benefit-start");
  const form = document.getElementById("benefit-form");
  const offer = document.getElementById("benefit-offer");
  const uid = document.getElementById("benefit-uid");
  const date = document.getElementById("benefit-date");
  const ready = document.getElementById("benefit-ready");
  const preview = document.getElementById("benefit-message-preview");
  const telegram = document.getElementById("benefit-telegram");

  date.max = new Date().toISOString().slice(0, 10);

  start.addEventListener("click", () => {
    form.hidden = false;
    start.hidden = true;
    offer.focus();
    track("beneficio_verificacao_iniciada");
  });

  form.addEventListener("input", () => {
    ready.hidden = true;
    telegram.removeAttribute("href");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const cleanUid = uid.value.trim();
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(cleanUid)) {
      uid.setCustomValidity("Use somente letras, números, _ ou - do UID da plataforma.");
      uid.reportValidity();
      return;
    }
    uid.setCustomValidity("");

    const selectedDate = new Date(date.value + "T00:00:00");
    if (Number.isNaN(selectedDate.getTime()) || selectedDate > new Date()) {
      date.setCustomValidity("Informe uma data de cadastro válida, sem usar uma data futura.");
      date.reportValidity();
      return;
    }
    date.setCustomValidity("");

    const channel = getChannel() || "direto";
    const variant = getVariant();
    const message = [
      "Olá, Tiago. Quero solicitar o benefício temporário para indicados do site Sobrevive ou Quebra?.",
      "",
      `Plataforma: ${offer.value}`,
      `UID: ${cleanUid}`,
      `Data do cadastro: ${date.value.split("-").reverse().join("/")}`,
      `Origem do site: ${channel} · variante ${variant}`,
      "",
      "Confirmo que me cadastrei pelo link do site e entendo que o benefício depende da confirmação no painel e da disponibilidade.",
    ].join("\n");

    preview.textContent = message;
    telegram.href = getTelegramLink(message);
    ready.hidden = false;
    ready.scrollIntoView({ behavior: "smooth", block: "nearest" });
    track("beneficio_solicitacao_preparada_" + offer.value.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  });

  uid.addEventListener("input", () => uid.setCustomValidity(""));
  date.addEventListener("input", () => date.setCustomValidity(""));
  telegram.addEventListener("click", () => track("beneficio_abriu_telegram"));
}

// ============================================================
// SIMULADOR DE PROTEÇÃO
// ============================================================
let lastMcResult = null;
let lastSimParams = null;

const controles = {
  exposicao: document.getElementById("exposicao"),
  meses: document.getElementById("meses"),
  cobertura: document.getElementById("cobertura"),
  tolerancia: document.getElementById("tolerancia"),
  ativo: document.getElementById("ativo"),
  rota: document.getElementById("rota"),
  alavancagem: document.getElementById("alavancagem"),
  funding: document.getElementById("funding"),
  premio: document.getElementById("premio"),
};

function readSimParams() {
  return {
    exposicao: Number(controles.exposicao.value),
    meses: Number(controles.meses.value),
    cobertura: Number(controles.cobertura.value) / 100,
    toleranciaPct: Number(controles.tolerancia.value) / 100,
    volPreset: controles.ativo.value,
    rota: controles.rota.value,
    alavancagemHedge: Number(controles.alavancagem.value),
    fundingAnual: Number(controles.funding.value) / 100,
    premioPct: Number(controles.premio.value) / 100,
    simulacoes: 1000,
  };
}

function updateSimLabels(p) {
  document.getElementById("val-exposicao").textContent = formatBRLShort(p.exposicao);
  document.getElementById("val-meses").textContent = p.meses + (p.meses === 1 ? " mês" : " meses");
  document.getElementById("val-cobertura").textContent = Math.round(p.cobertura * 100) + "%";
  document.getElementById("val-tolerancia").textContent = Math.round(p.toleranciaPct * 100) + "%";
  document.getElementById("val-alav").textContent = p.alavancagemHedge + "x";
  document.getElementById("val-funding").textContent = Math.round(p.fundingAnual * 100) + "%";
  document.getElementById("val-premio").textContent = (p.premioPct * 100).toFixed(1) + "%";

  // Cada rota tem os seus próprios custos; mostrar controle que não afeta
  // aquela rota faria a pessoa mexer num número que não muda nada.
  document.getElementById("controles-futuros").hidden = p.rota !== "futuros";
  document.getElementById("controles-seguro").hidden = p.rota !== "seguro";

  // Âncora de preço do seguro. Sem ela, um prêmio baixo demais faz a
  // simulação sugerir que seguro dá lucro — o que não existe em mercado real.
  const referencia = premioReferencia(p.volPreset, p.meses);
  const nota = document.getElementById("nota-premio");
  const refTexto = `Referência para esse ativo e prazo: cerca de ${(referencia * 100).toFixed(0)}%.`;
  if (p.premioPct < referencia * 0.6) {
    nota.textContent = `${refTexto} O valor informado está bem abaixo disso — com um prêmio desses o seguro pareceria dar lucro, o que não acontece com preços reais. Confira a cotação na corretora antes de concluir qualquer coisa.`;
  } else if (p.premioPct > referencia * 1.8) {
    nota.textContent = `${refTexto} O valor informado está bem acima disso, o que torna a proteção cara em relação ao risco que ela remove.`;
  } else {
    nota.textContent = `${refTexto} Substitua pelo prêmio real cotado na sua corretora — este número é âncora, não cotação.`;
  }
}

// ---------- Porta emocional ----------
// A peça começa por um medo específico, não por uma planilha: é o que o
// reposicionamento pede (psicologia antes de mecânica) e é onde os
// protocolos psicológicos vão se conectar depois. Cada resposta apenas
// PRÉ-CONFIGURA os controles — a pessoa continua livre para mexer em tudo.
const MEDOS = {
  cair: {
    eco: "Medo de cair e não voltar. Então o que importa é o tamanho do buraco no pior cenário, não a média — o simulador começa cobrindo a posição inteira num prazo longo.",
    valores: { meses: 12, cobertura: 100, tolerancia: 20, rota: "seguro" },
  },
  precisar: {
    eco: "Medo de precisar do dinheiro no pior momento. Aqui o prazo manda mais que o preço: proteção curta e barata costuma bater proteção perfeita e cara.",
    valores: { meses: 3, cobertura: 60, tolerancia: 10, rota: "reduzir" },
  },
  dormir: {
    eco: "Se a posição tira o seu sono, normalmente ela está maior do que a sua tolerância real — e reduzir resolve mais barato do que qualquer derivativo. O simulador já começa por essa rota.",
    valores: { meses: 6, cobertura: 50, tolerancia: 15, rota: "reduzir" },
  },
  devolver: {
    eco: "Medo de devolver o que já ganhou. É o caso clássico de travar parte do resultado: cobrir tudo custa caro e devolve pouco — veja o efeito no bolso antes de decidir a dose.",
    valores: { meses: 3, cobertura: 70, tolerancia: 25, rota: "futuros" },
  },
};

function aplicarMedo(chave) {
  const medo = MEDOS[chave];
  if (!medo) return;
  const v = medo.valores;
  controles.meses.value = v.meses;
  controles.cobertura.value = v.cobertura;
  controles.tolerancia.value = v.tolerancia;
  controles.rota.value = v.rota;

  document.getElementById("medo-eco").textContent = medo.eco;
  document.querySelectorAll("#medo-opcoes button").forEach((b) => {
    const ativo = b.dataset.medo === chave;
    b.classList.toggle("btn-primary", ativo);
    b.classList.toggle("btn-secondary", !ativo);
    b.setAttribute("aria-pressed", ativo ? "true" : "false");
  });

  track("medo_escolhido_" + chave);
  runSimAndRender();
}

document.querySelectorAll("#medo-opcoes button").forEach((botao) => {
  botao.setAttribute("aria-pressed", "false");
  botao.addEventListener("click", () => aplicarMedo(botao.dataset.medo));
});

let simDebounce = null;
function runSimAndRender() {
  const params = readSimParams();
  updateSimLabels(params);
  clearTimeout(simDebounce);
  simDebounce = setTimeout(() => {
    const result = simularProtecao(params);
    lastMcResult = result;
    lastSimParams = params;
    renderSimResult(result, params);
    track("simulacao_rodada");
  }, 120);
}

const ROTA_LABEL = {
  nada: "não fazer nada",
  reduzir: "reduzir a posição",
  futuros: "travar com futuros",
  seguro: "comprar seguro",
};

// A oferta é continuação do diagnóstico (CONVERSION_FRAMEWORK do kit): ela
// responde à rota que a pessoa acabou de escolher. Duas dessas rotas não
// exigem conta nova nenhuma — e dizer isso é a parte que constrói confiança.
const CONVERSAO_POR_ROTA = {
  nada: {
    precisaConta: false,
    tag: "Nenhuma conta necessária",
    headline: "Não agir também é uma decisão — e ela não exige abrir nada.",
    sub: "Você viu o tamanho do risco que já corre. Se a conclusão foi conviver com ele, não há produto para comprar aqui: o próximo passo é definir em que ponto você mudaria de ideia, antes de o preço decidir por você.",
    itens: [
      "Escreva agora qual queda faria você agir — e o que faria depois",
      "Revise o tamanho da posição em vez de prever o preço",
      "Volte a este simulador quando o valor exposto ou o seu prazo mudarem",
    ],
    fine: "Não recomendamos abrir conta para quem não vai usar. A oferta desta página só aparece nas rotas em que ela realmente faz diferença.",
  },
  reduzir: {
    precisaConta: false,
    tag: "Nenhuma conta necessária",
    headline: "Reduzir você faz onde a posição já está.",
    sub: "Essa é a proteção mais barata do simulador e a única que não depende de derivativo, margem ou prêmio. Ela se executa na mesma plataforma onde o seu dinheiro já está — abrir conta nova não ajudaria em nada.",
    itens: [
      "Defina quanto reduzir antes de abrir a tela de ordens",
      "Considere custo de saída e imposto na conta final",
      "Reduzir parcialmente é decisão válida; não precisa ser tudo ou nada",
    ],
    fine: "Se em algum momento você quiser comparar custos de execução entre plataformas, o simulador continua aqui — mas para esta rota você não precisa de conta nova.",
  },
  futuros: {
    precisaConta: true,
    tag: "Seu próximo passo",
    headline: "Travar preço exige plataforma com derivativos — e o custo sai das taxas.",
    sub: "Essa rota depende de mercado futuro, margem e funding visíveis. Cada montagem e desmontagem cobra, e é isso que corrói o resultado que você acabou de ver. Se ainda não tem Binance, o link abaixo ativa o cashback vitalício de Spot dessa indicação; se já tem conta, responda duas perguntas e receba uma alternativa que você possa usar.",
    itens: [
      "Cashback vitalício nas taxas elegíveis de Spot pelo código BOSS2026",
      "Confira margem, funding e preço de liquidação antes de montar qualquer proteção",
      "Roteamento sem empilhar links nem recomendar conta que você já possui",
    ],
    fine: "A abertura da conta não obriga você a montar proteção nenhuma. Só use derivativos depois de entender margem, liquidação e custo de carregamento — inclusive a possibilidade de a proteção ser encerrada antes da hora, como o simulador mostrou.",
  },
  seguro: {
    precisaConta: true,
    tag: "Seu próximo passo",
    headline: "Seguro exige um mercado de opções — e ele não existe em todo lugar.",
    sub: "Comprar uma opção de venda depende de plataforma com mercado de opções e liquidez suficiente no vencimento que você quer. No Brasil o acesso a opções de cripto é limitado, então confirme disponibilidade, prazos e prêmio real antes de contar com esta rota.",
    itens: [
      "Confirme quais vencimentos existem e a que preço, antes de assumir o prêmio",
      "O prêmio deste simulador é o que você informa — não é cotação nossa",
      "Se as opções não estiverem acessíveis, reduzir posição continua sendo alternativa honesta",
    ],
    fine: "Não afirmamos que uma corretora específica oferece as opções que você precisa: isso muda por região e por data. Verifique na própria plataforma antes de decidir.",
  },
};

function renderConvertBlock(rota) {
  const c = CONVERSAO_POR_ROTA[rota];
  document.getElementById("convert-tag").textContent = c.tag;
  document.getElementById("convert-headline").textContent = c.headline;
  document.getElementById("convert-sub").textContent = c.sub;
  document.getElementById("convert-fine").textContent = c.fine;

  const lista = document.getElementById("convert-list");
  lista.replaceChildren();
  c.itens.forEach((texto) => {
    const li = document.createElement("li");
    li.textContent = texto;
    lista.appendChild(li);
  });

  document.getElementById("convert-botoes").hidden = !c.precisaConta;
}

function renderSimResult(result, params) {
  const banner = document.getElementById("result-banner");
  const semPct = result.cenariosRuinsSemProtecao * 100;
  const comPct = result.cenariosRuinsComProtecao * 100;
  const evitados = semPct - comPct;
  const melhorou = evitados > 0.5;
  banner.className = "result-banner " + (melhorou ? "survive" : "ruin");

  const perdaLimite = Math.round(params.toleranciaPct * 100);

  if (params.rota === "nada") {
    document.getElementById("result-big").textContent = semPct.toFixed(0) + "% dos cenários";
    document.getElementById("result-label").textContent =
      `terminam com perda maior que ${perdaLimite}% — este é o seu risco atual, sem nenhuma proteção`;
  } else if (melhorou) {
    document.getElementById("result-big").textContent = evitados.toFixed(0) + " em cada 100 cenários";
    document.getElementById("result-label").textContent =
      `deixam de estourar a sua perda máxima de ${perdaLimite}% ao ${ROTA_LABEL[params.rota]} — e a conta desse alívio está ao lado`;
  } else {
    document.getElementById("result-big").textContent = "quase nada muda";
    document.getElementById("result-label").textContent =
      `${ROTA_LABEL[params.rota]} nessa dose não reduz os cenários que estouram ${perdaLimite}% — só adiciona custo`;
  }

  document.getElementById("stat-ruins-sem").textContent = semPct.toFixed(0) + "%";
  document.getElementById("stat-ruins-com").textContent =
    params.rota === "nada" ? "—" : comPct.toFixed(0) + "%";

  const diff = result.diferencaMedia;
  document.getElementById("stat-custo").textContent =
    params.rota === "nada" ? "—" : (diff >= 0 ? "+" : "−") + formatBRLShort(Math.abs(diff));

  // Só futuros podem ser liquidados; nas outras rotas a caixa não se aplica
  // e uma caixa vazia sozinha numa linha só polui o resultado.
  const liq = result.taxaLiquidacaoProtecao;
  document.getElementById("box-liquidacao").hidden = liq === null;
  document.getElementById("stat-liquidacao").textContent =
    liq === null ? "—" : (liq * 100).toFixed(0) + "%";

  const canvas = document.getElementById("equity-canvas");
  drawEquityCurves(canvas, result, params.exposicao);

  renderConvertBlock(params.rota);
  const convertBlock = document.getElementById("convert-sim");
  convertBlock.classList.add("visible");
}

function formatBRLShort(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

Object.values(controles).forEach((el) => {
  el.addEventListener("input", runSimAndRender);
  el.addEventListener("change", runSimAndRender);
});
window.addEventListener("resize", () => {
  if (lastMcResult) drawEquityCurves(document.getElementById("equity-canvas"), lastMcResult, lastSimParams.exposicao);
});

document.getElementById("btn-download-sim-card").addEventListener("click", () => {
  if (!lastMcResult) return;
  const canvas = generateSimulatorCard(lastMcResult, lastSimParams);
  downloadCanvasAsPng(canvas, "sobrevive-ou-quebra.png");
  track("download_card_simulador");
});

// ============================================================
// CALCULADORA DE TAMANHO DA PROTEÇÃO
// ============================================================
function runCalc() {
  const exposicao = Number(document.getElementById("calc-exposicao").value) || 0;
  const coberturaPct = Number(document.getElementById("calc-cobertura").value) || 0;
  const preco = Number(document.getElementById("calc-preco").value) || 0;
  const alavancagem = Number(document.getElementById("calc-alav").value) || 0;

  const nocional = exposicao * (coberturaPct / 100);
  const margem = alavancagem > 0 ? nocional / alavancagem : 0;
  // A perna vendida perde quando o preço sobe; a margem acaba em +1/alavancagem.
  const precoLiquidacao = alavancagem > 0 ? preco * (1 + 1 / alavancagem) : 0;

  document.getElementById("calc-nocional").textContent = nocional > 0 ? formatBRLShort(nocional) : "—";
  document.getElementById("calc-margem").textContent = margem > 0 ? formatBRLShort(margem) : "—";
  document.getElementById("calc-liquidacao").textContent =
    precoLiquidacao > 0
      ? precoLiquidacao.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) +
        ` (+${(100 / alavancagem).toFixed(0)}%)`
      : "—";
}
["calc-exposicao", "calc-cobertura", "calc-preco", "calc-alav"].forEach((id) =>
  document.getElementById(id).addEventListener("input", runCalc)
);

// ============================================================
// INIT
// ============================================================
applyVariant();
wireConversionLinks();
initReferralBenefit();
runSimAndRender();
runCalc();

// Analytics opcional. O identificador precisa ser um subdomínio simples;
// valores inválidos não geram script nem requisição externa.
if (CONFIG.goatCounterSite && /^[a-z0-9-]{1,63}$/.test(CONFIG.goatCounterSite)) {
  const gc = document.createElement("script");
  gc.async = true;
  gc.dataset.goatcounter = `https://${CONFIG.goatCounterSite}.goatcounter.com/count`;
  gc.src = "https://gc.zgo.at/count.js";
  document.head.appendChild(gc);
}
