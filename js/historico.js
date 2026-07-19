const MAX_CSV_BYTES = 5 * 1024 * 1024;
const FEE_SCENARIO_PCT = 0.10;
let pendingHeaders = null;
let pendingRows = null;
let lastMetrics = null;

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

function formatBRLShort(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function preserveCampaignParams(url) {
  const target = new URL(url, window.location.href);
  const channel = getChannel();
  const variant = getVariant();
  if (channel) target.searchParams.set("c", channel);
  target.searchParams.set("v", variant);
  return target.toString();
}

const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("file-input");

uploadZone.addEventListener("click", () => fileInput.click());
uploadZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});
uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.classList.add("dragover");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.classList.remove("dragover");
  if (event.dataTransfer.files.length) handleFile(event.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (event) => {
  if (event.target.files.length) handleFile(event.target.files[0]);
});

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    alert("Use um arquivo CSV exportado da corretora.");
    return;
  }
  if (file.size > MAX_CSV_BYTES) {
    alert("O arquivo deve ter no máximo 5 MB. Exporte um período menor.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => processCSVText(event.target.result);
  reader.onerror = () => alert("Não conseguimos ler o arquivo local. Nenhum dado foi enviado.");
  reader.readAsText(file);
  track("historico_upload_csv");
}

document.getElementById("btn-example").addEventListener("click", () => {
  processCSVText(generateExampleCSV());
  track("historico_ver_exemplo");
});

function processCSVText(text) {
  if (typeof text !== "string" || text.length > MAX_CSV_BYTES) {
    alert("O conteúdo excede o limite local de 5 MB.");
    return;
  }
  const { headers, rows, error } = parseCSV(text);
  if (error === "too_many_rows") {
    alert("Analise no máximo 20.000 linhas por vez.");
    return;
  }
  if (error === "too_many_columns") {
    alert("O CSV tem colunas demais. Exporte apenas o histórico de trades.");
    return;
  }
  if (!headers.length || !rows.length) {
    alert("Não conseguimos ler esse CSV.");
    return;
  }
  pendingHeaders = headers;
  pendingRows = rows;
  const mapping = autoDetectMapping(headers);
  if (!mapping.pnl) showMappingPanel(headers, mapping);
  else finalizeMapping(mapping);
}

function showMappingPanel(headers, mapping) {
  const panel = document.getElementById("mapping-panel");
  const container = document.getElementById("mapping-rows");
  container.innerHTML = "";
  const labels = {
    pnl: "Resultado do trade (P&L) *obrigatório",
    date: "Data/hora",
    symbol: "Símbolo/par",
    side: "Lado",
    qty: "Quantidade",
    price: "Preço",
    fee: "Taxa/comissão",
  };
  Object.entries(labels).forEach(([field, label]) => {
    const row = document.createElement("div");
    row.className = "mapping-row";
    const labelElement = document.createElement("label");
    labelElement.textContent = label;
    const select = document.createElement("select");
    select.dataset.field = field;
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— nenhuma —";
    select.appendChild(empty);
    headers.forEach((header) => {
      const option = document.createElement("option");
      option.value = header;
      option.textContent = header;
      option.selected = mapping[field] === header;
      select.appendChild(option);
    });
    row.append(labelElement, select);
    container.appendChild(row);
  });
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("btn-confirm-mapping").addEventListener("click", () => {
  const mapping = {};
  document.querySelectorAll("#mapping-rows select").forEach((select) => {
    mapping[select.dataset.field] = select.value || null;
  });
  if (!mapping.pnl) {
    alert("Indique a coluna que contém o resultado do trade (P&L).");
    return;
  }
  document.getElementById("mapping-panel").hidden = true;
  finalizeMapping(mapping);
});

function finalizeMapping(mapping) {
  const trades = toCanonicalTrades(pendingRows, mapping);
  if (!trades.length) {
    alert("Não encontramos trades com P&L válido.");
    return;
  }
  lastMetrics = computeMetrics(trades);
  renderRaioX(lastMetrics);
  track("historico_diagnostico_gerado");
}

function renderRaioX(metrics) {
  const results = document.getElementById("raiox-results");
  results.hidden = false;
  document.getElementById("rx-winrate").textContent = `${(metrics.winRate * 100).toFixed(0)}%`;
  document.getElementById("rx-pf").textContent = metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2);
  document.getElementById("rx-trades").textContent = metrics.totalTrades;
  document.getElementById("rx-fees").textContent = formatBRLShort(metrics.totalFees);
  document.getElementById("rx-dd").textContent = formatBRLShort(metrics.maxDrawdown);
  document.getElementById("rx-rr").textContent = metrics.realizedRR !== null ? metrics.realizedRR.toFixed(2) : "—";
  const list = document.getElementById("findings-list");
  list.innerHTML = "";
  const findings = buildDiagnosis(metrics, FEE_SCENARIO_PCT);
  findings.forEach((finding) => {
    const box = document.createElement("div");
    box.className = `finding sev-${finding.severity}`;
    const title = document.createElement("div");
    title.className = "finding-title";
    title.textContent = finding.title;
    const text = document.createElement("div");
    text.className = "finding-text";
    text.textContent = finding.text;
    box.append(title, text);
    list.appendChild(box);
  });
  document.getElementById("convert-rx").classList.add("visible");
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("btn-download-rx-card").addEventListener("click", () => {
  if (!lastMetrics) return;
  const canvas = generateRaioXCard(lastMetrics);
  downloadCanvasAsPng(canvas, "raio-x-trader.png");
  track("historico_download_card");
});

const offerResult = document.getElementById("offer-result");
const offerTitle = document.getElementById("offer-title");
const offerReason = document.getElementById("offer-reason");
const offerCta = document.getElementById("offer-cta");
const offerNote = document.getElementById("offer-note");

document.querySelectorAll(".router-choice").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".router-choice").forEach((peer) => peer.classList.toggle("selected", peer === button));
    const hasBinance = button.dataset.hasBinance === "yes";
    if (hasBinance) {
      offerTitle.textContent = "Você já tem Binance: não há benefício de conta nova para ativar";
      offerReason.textContent = "A recomendação principal passa a ser comparar outra plataforma somente quando ela resolver uma necessidade real, sem abrir conta apenas por abrir.";
      offerCta.href = preserveCampaignParams(CONFIG.offers.bybit.url);
      offerCta.textContent = "Ver alternativa contextual →";
      offerNote.textContent = "Benefícios dependem de região, prazo e elegibilidade. Confira as condições exibidas no cadastro.";
      offerCta.dataset.offer = "bybit";
      track("historico_contexto_ja_tem_binance");
    } else {
      offerTitle.textContent = "Binance para uma conta nova elegível";
      offerReason.textContent = "Como você ainda não possui Binance, o benefício de indicação pode ser aplicável. A abertura da conta não obriga você a operar futuros.";
      offerCta.href = preserveCampaignParams(getRefLink());
      offerCta.textContent = "Ver cadastro com o código BOSS2026 →";
      offerNote.textContent = "Confirme na tela de cadastro o benefício disponível e as regras vigentes para sua região.";
      offerCta.dataset.offer = "binance";
      track("historico_contexto_sem_binance");
    }
    offerResult.hidden = false;
  });
});

offerCta.addEventListener("click", () => track(`historico_clique_oferta_${offerCta.dataset.offer || "desconhecida"}`));
