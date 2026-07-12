// ============================================================
// Desenho de curvas de equity em <canvas>, sem dependências.
// ============================================================

function drawEquityCurves(canvas, mcResult, initialBankroll) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const curves = mcResult.sampleCurves;
  let maxY = initialBankroll * 1.2;
  curves.forEach((c) => {
    c.equity.forEach((v) => {
      if (v > maxY) maxY = v;
    });
  });
  // clip extremos absurdos pra não achatar o gráfico (cap em p95 visual)
  const allVals = curves.flatMap((c) => c.equity);
  allVals.sort((a, b) => a - b);
  const cap = allVals[Math.floor(allVals.length * 0.97)] || maxY;
  maxY = Math.max(cap, initialBankroll * 1.1);

  const minY = 0;
  const padding = { top: 16, right: 16, bottom: 28, left: 48 };
  const plotW = cssWidth - padding.left - padding.right;
  const plotH = cssHeight - padding.top - padding.bottom;

  const xForIndex = (i, len) => padding.left + (i / (len - 1)) * plotW;
  const yForValue = (v) => {
    const clamped = Math.min(v, maxY);
    return padding.top + plotH - (clamped / (maxY - minY)) * plotH;
  };

  // linha da banca inicial (referência)
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const yInit = yForValue(initialBankroll);
  ctx.moveTo(padding.left, yInit);
  ctx.lineTo(cssWidth - padding.right, yInit);
  ctx.stroke();
  ctx.setLineDash([]);

  // grid horizontal leve
  ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = (maxY / ySteps) * i;
    const y = yForValue(val);
    ctx.fillText(formatCurrencyShort(val), padding.left - 6, y);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(cssWidth - padding.right, y);
    ctx.stroke();
  }

  // curvas individuais
  curves.forEach((c) => {
    const len = c.equity.length;
    ctx.beginPath();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = c.ruined
      ? "rgba(248, 113, 113, 0.55)"
      : "rgba(74, 222, 128, 0.35)";
    c.equity.forEach((v, i) => {
      const x = xForIndex(i, len);
      const y = yForValue(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  // eixo X label
  ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
  ctx.textAlign = "center";
  ctx.fillText("trade nº", cssWidth / 2, cssHeight - 10);
}

function formatCurrencyShort(v) {
  if (v >= 1000) return "R$" + (v / 1000).toFixed(1) + "k";
  return "R$" + Math.round(v);
}
