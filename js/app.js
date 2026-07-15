// ============================================================
// Wiring da UI — conecta sliders/upload aos módulos de cálculo.
// ============================================================

const FEE_SCENARIO_PCT = 0.10; // cenário educacional; não presume que uma oferta cobre o CSV analisado
const MAX_CSV_BYTES = 5 * 1024 * 1024;

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
      'Descubra em 30 segundos se você vai <span class="highlight">quebrar</span> operando futuros.';
    document.getElementById("subheadline").textContent =
      "1.000 simulações da sua estratégia, resultado na hora — sem cadastro, sem instalar nada, sem enrolação.";
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
    title: "Bybit como segunda corretora",
    cta: "Conhecer a Bybit →",
    points: [
      "Alternativa ampla para spot, derivativos, pagamentos e cartão",
      "Útil para quem já tem Binance e quer separar estratégias ou comparar execução",
      "Código de referência: O0YDQDM",
    ],
    note: "Produtos, recompensas e cartão variam por país. Confira KYC, tarefas e condições exibidas no cadastro.",
  },
  etherfi: {
    title: "ether.fi Cash para gastos e viagens",
    cta: "Ver a oferta do ether.fi Cash →",
    points: [
      "Cartão focado em gastar stablecoins e cripto no dia a dia",
      "Cashback pode chegar a 3% conforme tier, promoção, gasto e transação elegível",
      "Comece o cadastro no navegador pelo link; instale o app somente depois",
    ],
    note: "O fluxo navegador → cadastro → aplicativo é importante para a atribuição da promoção. Confira cashback, FX, taxas, limites e elegibilidade antes de concluir.",
  },
  okx: {
    title: "Cartão OKX Brasil",
    cta: "Ver a oferta da OKX →",
    points: [
      "Cartão virtual conectado ao saldo em USD do OKX Pay",
      "A tabela atual do produto brasileiro informa IOF zero e sem anuidade",
      "Código de referência: 30985036",
    ],
    note: "Condições do produto brasileiro. Câmbio em moeda diferente de USD usa a taxa da Mastercard; elegibilidade e campanhas podem mudar.",
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
// PORTA 1 — SIMULADOR
// ============================================================
let lastMcResult = null;
let lastSimParams = null;

const sliders = {
  bankroll: document.getElementById("bankroll"),
  leverage: document.getElementById("leverage"),
  riskPct: document.getElementById("riskPct"),
  winRate: document.getElementById("winRate"),
  rr: document.getElementById("rr"),
};

function readSimParams() {
  return {
    bankroll: Number(sliders.bankroll.value),
    leverage: Number(sliders.leverage.value),
    riskPct: Number(sliders.riskPct.value) / 100,
    winRate: Number(sliders.winRate.value) / 100,
    rr: Number(sliders.rr.value),
    numTrades: 100,
  };
}

function updateSimLabels(p) {
  document.getElementById("val-bankroll").textContent = "R$ " + p.bankroll.toLocaleString("pt-BR");
  document.getElementById("val-leverage").textContent = p.leverage + "x";
  document.getElementById("val-risk").textContent = (p.riskPct * 100).toFixed(1) + "%";
  document.getElementById("val-winrate").textContent = Math.round(p.winRate * 100) + "%";
  document.getElementById("val-rr").textContent = p.rr.toFixed(1);
}

let simDebounce = null;
function runSimAndRender() {
  const params = readSimParams();
  updateSimLabels(params);
  clearTimeout(simDebounce);
  simDebounce = setTimeout(() => {
    const result = runMonteCarlo(params, 1000);
    lastMcResult = result;
    lastSimParams = params;
    renderSimResult(result, params);
    track("simulacao_rodada");
  }, 120);
}

function renderSimResult(result, params) {
  const banner = document.getElementById("result-banner");
  const survived = result.ruinRate < 0.5;
  banner.className = "result-banner " + (survived ? "survive" : "ruin");

  document.getElementById("result-big").textContent =
    (result.ruinRate * 100).toFixed(0) + "% quebram";
  document.getElementById("result-label").textContent = survived
    ? "a maioria dos cenários sobrevive aos 100 trades — mas repare no risco de cauda"
    : "a maioria dos cenários quebra a banca antes do trade 100";

  document.getElementById("stat-ruin-trade").textContent =
    result.avgRuinTrade !== null ? "#" + result.avgRuinTrade : "—";
  document.getElementById("stat-median").textContent = formatBRLShort(result.median);
  document.getElementById("stat-p90").textContent = formatBRLShort(result.p90);

  const canvas = document.getElementById("equity-canvas");
  drawEquityCurves(canvas, result, params.bankroll);

  const convertBlock = document.getElementById("convert-sim");
  convertBlock.classList.add("visible");
}

function formatBRLShort(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

Object.values(sliders).forEach((el) => el.addEventListener("input", runSimAndRender));
window.addEventListener("resize", () => {
  if (lastMcResult) drawEquityCurves(document.getElementById("equity-canvas"), lastMcResult, lastSimParams.bankroll);
});

document.getElementById("btn-download-sim-card").addEventListener("click", () => {
  if (!lastMcResult) return;
  const canvas = generateSimulatorCard(lastMcResult, lastSimParams);
  downloadCanvasAsPng(canvas, "sobrevive-ou-quebra.png");
  track("download_card_simulador");
});

// ============================================================
// PORTA 2 — RAIO-X (upload CSV)
// ============================================================
let pendingHeaders = null;
let pendingRows = null;
let lastMetrics = null;

const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("file-input");

uploadZone.addEventListener("click", () => fileInput.click());
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("dragover");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    alert("Use um arquivo CSV exportado pela corretora.");
    return;
  }
  if (file.size > MAX_CSV_BYTES) {
    alert("Por segurança, o arquivo deve ter no máximo 5 MB. Exporte um período menor e tente novamente.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => processCSVText(e.target.result);
  reader.onerror = () => alert("Não conseguimos ler o arquivo local. Nenhum dado foi enviado.");
  reader.readAsText(file);
  track("upload_csv");
}

document.getElementById("btn-example").addEventListener("click", () => {
  processCSVText(generateExampleCSV());
  track("ver_exemplo");
});

function processCSVText(text) {
  if (typeof text !== "string" || text.length > MAX_CSV_BYTES) {
    alert("O conteúdo excede o limite local de 5 MB.");
    return;
  }
  const { headers, rows, error } = parseCSV(text);
  if (error === "too_many_rows") {
    alert("Por segurança, analise no máximo 20.000 linhas por vez. Exporte um período menor.");
    return;
  }
  if (error === "too_many_columns") {
    alert("O CSV tem colunas demais para uma análise segura. Exporte apenas o histórico de trades.");
    return;
  }
  if (!headers.length || !rows.length) {
    alert("Não conseguimos ler esse arquivo. Confirme que é um CSV exportado do seu histórico de trades.");
    return;
  }
  pendingHeaders = headers;
  pendingRows = rows;

  const mapping = autoDetectMapping(headers);
  const missingCritical = !mapping.pnl; // pnl é o único campo realmente obrigatório

  if (missingCritical) {
    showMappingPanel(headers, mapping);
  } else {
    finalizeMapping(mapping);
  }
}

function showMappingPanel(headers, mapping) {
  const panel = document.getElementById("mapping-panel");
  const rowsContainer = document.getElementById("mapping-rows");
  rowsContainer.innerHTML = "";

  const fieldLabels = {
    pnl: "Resultado do trade (P&L / Realized Profit) *obrigatório",
    date: "Data/hora",
    symbol: "Símbolo/par",
    side: "Lado (compra/venda)",
    qty: "Quantidade",
    price: "Preço",
    fee: "Taxa/comissão",
  };

  Object.entries(fieldLabels).forEach(([field, label]) => {
    const row = document.createElement("div");
    row.className = "mapping-row";
    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    const select = document.createElement("select");
    select.dataset.field = field;
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "— nenhuma —";
    select.appendChild(noneOpt);
    headers.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h;
      if (mapping[field] === h) opt.selected = true;
      select.appendChild(opt);
    });
    row.appendChild(labelEl);
    row.appendChild(select);
    rowsContainer.appendChild(row);
  });

  panel.style.display = "block";
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("btn-confirm-mapping").addEventListener("click", () => {
  const selects = document.querySelectorAll("#mapping-rows select");
  const mapping = {};
  selects.forEach((s) => (mapping[s.dataset.field] = s.value || null));
  if (!mapping.pnl) {
    alert("É preciso indicar qual coluna tem o resultado do trade (P&L) pra gerar o diagnóstico.");
    return;
  }
  document.getElementById("mapping-panel").style.display = "none";
  finalizeMapping(mapping);
});

function finalizeMapping(mapping) {
  const trades = toCanonicalTrades(pendingRows, mapping);
  if (!trades.length) {
    alert("Não encontramos trades com resultado (P&L) válido nesse arquivo.");
    return;
  }
  const metrics = computeMetrics(trades);
  lastMetrics = metrics;
  renderRaioX(metrics);
  track("diagnostico_gerado");
}

function renderRaioX(m) {
  document.getElementById("raiox-results").style.display = "block";
  document.getElementById("rx-winrate").textContent = (m.winRate * 100).toFixed(0) + "%";
  document.getElementById("rx-pf").textContent = m.profitFactor === Infinity ? "∞" : m.profitFactor.toFixed(2);
  document.getElementById("rx-trades").textContent = m.totalTrades;
  document.getElementById("rx-fees").textContent = formatBRLShort(m.totalFees);
  document.getElementById("rx-dd").textContent = formatBRLShort(m.maxDrawdown);
  document.getElementById("rx-rr").textContent = m.realizedRR !== null ? m.realizedRR.toFixed(2) : "—";

  const findings = buildDiagnosis(m, FEE_SCENARIO_PCT);
  const list = document.getElementById("findings-list");
  list.innerHTML = "";
  findings.forEach((f) => {
    const div = document.createElement("div");
    div.className = "finding sev-" + f.severity;
    const title = document.createElement("div");
    title.className = "finding-title";
    title.textContent = f.title;
    const text = document.createElement("div");
    text.className = "finding-text";
    text.textContent = f.text;
    div.append(title, text);
    list.appendChild(div);
  });
  if (!findings.length) {
    const div = document.createElement("div");
    div.className = "finding sev-1";
    const title = document.createElement("div");
    title.className = "finding-title";
    title.textContent = "Gestão de risco consistente";
    const text = document.createElement("div");
    text.className = "finding-text";
    text.textContent = "Não identificamos padrões problemáticos óbvios nesse histórico — bom sinal.";
    div.append(title, text);
    list.appendChild(div);
  }

  const savings = m.totalFees * FEE_SCENARIO_PCT;
  document.getElementById("rx-savings").textContent =
    formatBRLShort(savings) + " preservados num cenário de 10% menos taxa";
  document.getElementById("convert-rx").classList.add("visible");

  document.getElementById("raiox-results").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("btn-download-rx-card").addEventListener("click", () => {
  if (!lastMetrics) return;
  const canvas = generateRaioXCard(lastMetrics);
  downloadCanvasAsPng(canvas, "raio-x-trader.png");
  track("download_card_raiox");
});

// ============================================================
// CALCULADORA DE POSITION SIZE
// ============================================================
function runCalc() {
  const bankroll = Number(document.getElementById("calc-bankroll").value) || 0;
  const riskPct = Number(document.getElementById("calc-risk").value) || 0;
  const entry = Number(document.getElementById("calc-entry").value) || 0;
  const stop = Number(document.getElementById("calc-stop").value) || 0;

  const riskValue = bankroll * (riskPct / 100);
  const stopDistance = Math.abs(entry - stop);
  const positionSize = stopDistance > 0 ? riskValue / stopDistance : 0;

  document.getElementById("calc-position").textContent =
    positionSize > 0 ? positionSize.toFixed(4) + " un." : "—";
  document.getElementById("calc-riskval").textContent = formatBRLShort(riskValue);
}
["calc-bankroll", "calc-risk", "calc-entry", "calc-stop"].forEach((id) =>
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
