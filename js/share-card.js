// ============================================================
// Gera um card 1080x1080 (canvas) pra download/compartilhamento.
// Todo card termina em cupom de presente (cashback vitalício no Spot),
// não só estatística — ver BRAND.md do ferramenta-kit.
// ============================================================

function generateSimulatorCard(mcResult, params) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  drawCardBackground(ctx);

  ctx.textAlign = "center";
  ctx.fillStyle = "#E8EDF7";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText("SOBREVIVE OU QUEBRA?", 540, 120);

  const survived = mcResult.ruinRate < 0.5;
  ctx.font = "900 80px system-ui, sans-serif";
  ctx.fillStyle = survived ? "#6EE7A8" : "#f87171";
  ctx.fillText(survived ? "SOBREVIVEU" : "QUEBROU", 540, 300);

  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillStyle = "#9AA7C2";
  ctx.fillText(`${(mcResult.ruinRate * 100).toFixed(0)}% dos cenários quebram`, 540, 365);

  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  const details = [
    `Risco por trade: ${(params.riskPct * 100).toFixed(1)}%`,
    `Win rate: ${(params.winRate * 100).toFixed(0)}%  ·  R:R ${params.rr.toFixed(1)}`,
    `Alavancagem: ${params.leverage}x`,
  ];
  details.forEach((line, i) => ctx.fillText(line, 540, 435 + i * 40));

  drawCouponBox(ctx, {
    label: "PRESENTE POR TESTAR",
    offerText: "Cashback vitalício\nno Spot Binance",
  });
  return canvas;
}

function generateRaioXCard(metrics) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  drawCardBackground(ctx);

  ctx.textAlign = "center";
  ctx.fillStyle = "#E8EDF7";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText("RAIO-X DO TRADER", 540, 120);

  ctx.font = "900 90px system-ui, sans-serif";
  ctx.fillStyle = metrics.winRate >= 0.5 ? "#6EE7A8" : "#f87171";
  ctx.fillText(`${(metrics.winRate * 100).toFixed(0)}%`, 540, 300);

  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillStyle = "#9AA7C2";
  ctx.fillText("win rate", 540, 345);

  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  const pf = metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2);
  const details = [
    `Profit factor: ${pf}`,
    `${metrics.totalTrades} trades analisados`,
    `${(metrics.feeBleedPct * 100).toFixed(1)}% do volume em taxas`,
  ];
  details.forEach((line, i) => ctx.fillText(line, 540, 415 + i * 42));

  drawCouponBox(ctx, {
    label: "PRESENTE POR ANALISAR",
    offerText: "Cashback vitalício\nno Spot Binance",
  });
  return canvas;
}

function drawCardBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, "#06090F");
  grad.addColorStop(1, "#0E2148");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);
}

/** Caixa de cupom de presente: borda tracejada + oferta + link (bottom ~26%). */
function drawCouponBox(ctx, coupon) {
  const marginX = 90;
  const boxY = 760;
  const boxH = 260;
  const boxW = 1080 - marginX * 2;

  ctx.save();
  ctx.strokeStyle = "#4A8DF8";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(marginX, boxY, boxW, boxH, 20);
  else ctx.rect(marginX, boxY, boxW, boxH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.textAlign = "center";
  let cy = boxY + 60;

  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillStyle = "#4A8DF8";
  ctx.fillText("🎁 " + coupon.label, 540, cy);

  cy += 55;
  ctx.font = "800 36px system-ui, sans-serif";
  ctx.fillStyle = "#E8EDF7";
  String(coupon.offerText).split("\n").forEach((line) => {
    ctx.fillText(line, 540, cy);
    cy += 44;
  });

  cy = boxY + boxH - 30;
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillStyle = "#9AA7C2";
  ctx.fillText("Resgatar em: " + CONFIG.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""), 540, cy);
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
