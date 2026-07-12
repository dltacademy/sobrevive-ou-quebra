// ============================================================
// Gera um card 1080x1080 (canvas) pra download/compartilhamento.
// ============================================================

function generateSimulatorCard(mcResult, params) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  drawCardBackground(ctx);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText("SOBREVIVE OU QUEBRA?", 540, 130);

  const survived = mcResult.ruinRate < 0.5;
  ctx.font = "900 90px system-ui, sans-serif";
  ctx.fillStyle = survived ? "#4ade80" : "#f87171";
  ctx.fillText(survived ? "SOBREVIVEU" : "QUEBROU", 540, 320);

  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`${(mcResult.ruinRate * 100).toFixed(0)}% dos cenários quebram`, 540, 400);

  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  const details = [
    `Risco por trade: ${(params.riskPct * 100).toFixed(1)}%`,
    `Win rate: ${(params.winRate * 100).toFixed(0)}%  ·  R:R ${params.rr.toFixed(1)}`,
    `Alavancagem: ${params.leverage}x`,
  ];
  details.forEach((line, i) => ctx.fillText(line, 540, 480 + i * 44));

  drawCardFooter(ctx);
  return canvas;
}

function generateRaioXCard(metrics) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  drawCardBackground(ctx);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText("RAIO-X DO TRADER", 540, 130);

  ctx.font = "900 100px system-ui, sans-serif";
  ctx.fillStyle = metrics.winRate >= 0.5 ? "#4ade80" : "#f87171";
  ctx.fillText(`${(metrics.winRate * 100).toFixed(0)}%`, 540, 310);

  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("win rate", 540, 360);

  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  const pf = metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2);
  const details = [
    `Profit factor: ${pf}`,
    `${metrics.totalTrades} trades analisados`,
    `${(metrics.feeBleedPct * 100).toFixed(1)}% do volume em taxas`,
  ];
  details.forEach((line, i) => ctx.fillText(line, 540, 460 + i * 46));

  drawCardFooter(ctx);
  return canvas;
}

function drawCardBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);
}

function drawCardFooter(ctx) {
  ctx.textAlign = "center";
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillStyle = "#818cf8";
  ctx.fillText("Teste a sua em:", 540, 900);
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(CONFIG.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""), 540, 945);
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(CONFIG.brand, 540, 1000);
}

function downloadCanvasAsPng(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}
