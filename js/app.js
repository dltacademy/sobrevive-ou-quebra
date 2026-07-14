// ============================================================
// Wiring da UI — conecta sliders/upload aos módulos de cálculo.
// ============================================================

const REF_DISCOUNT_PCT = 0.10; // cashback vitalício de taxa estimado via link ref (ajustar se souber o valor exato)

function track(eventName) {
  if (window.goatcounter && window.goatcounter.count) {
    window.goatcounter.count({ path: eventName, event: true });
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
  const tg = getTelegramLink("Vim pelo Sobrevive ou Quebra? — quero a chamada de 15min");
  ["cta-ref-sim", "cta-ref-rx"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = ref;
  });
  ["cta-tg-sim", "cta-tg-rx"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = tg;
  });
  document.querySelectorAll("#cta-ref-sim, #cta-ref-rx").forEach((el) =>
    el.addEventListener("click", () => track("clique_ref"))
  );
  document.querySelectorAll("#cta-tg-sim, #cta-tg-rx").forEach((el) =>
    el.addEventListener("click", () => track("clique_telegram"))
  );
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
  const reader = new FileReader();
  reader.onload = (e) => processCSVText(e.target.result);
  reader.readAsText(file);
  track("upload_csv");
}

document.getElementById("btn-example").addEventListener("click", () => {
  processCSVText(generateExampleCSV());
  track("ver_exemplo");
});

function processCSVText(text) {
  const { headers, rows } = parseCSV(text);
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

  const findings = buildDiagnosis(m, REF_DISCOUNT_PCT);
  const list = document.getElementById("findings-list");
  list.innerHTML = "";
  findings.forEach((f) => {
    const div = document.createElement("div");
    div.className = "finding sev-" + f.severity;
    div.innerHTML = `<div class="finding-title">${f.title}</div><div class="finding-text">${f.text}</div>`;
    list.appendChild(div);
  });
  if (!findings.length) {
    list.innerHTML = '<div class="finding sev-1"><div class="finding-title">Gestão de risco consistente</div><div class="finding-text">Não identificamos padrões problemáticos óbvios nesse histórico — bom sinal.</div></div>';
  }

  const savings = m.totalFees * REF_DISCOUNT_PCT;
  document.getElementById("rx-savings").textContent = formatBRLShort(savings) + " a menos em taxas";
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
runSimAndRender();
runCalc();
