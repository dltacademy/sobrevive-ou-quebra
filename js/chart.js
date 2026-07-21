// ============================================================
// Desenho das trajetórias em <canvas>, sem dependências.
//
// Duas famílias de linhas sobre o MESMO sorteio: sem proteção e com a
// proteção escolhida. É o argumento central da página — proteção não
// melhora a média, ela muda o formato da distribuição.
// ============================================================

function drawEquityCurves(canvas, resultado, valorInicial) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const amostras = resultado.amostras || [];
  if (!amostras.length) return;

  // Escala com corte no percentil 97 para um cenário extremo não achatar o resto.
  const todos = amostras.flatMap((a) => a.sem.concat(a.com));
  todos.sort((a, b) => a - b);
  const teto = todos[Math.floor(todos.length * 0.97)] || valorInicial * 1.2;
  const maxY = Math.max(teto, valorInicial * 1.1);
  const minY = 0;

  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const plotW = cssWidth - padding.left - padding.right;
  const plotH = cssHeight - padding.top - padding.bottom;

  const xForIndex = (i, len) => padding.left + (i / (len - 1)) * plotW;
  const yForValue = (v) => {
    const clamped = Math.max(minY, Math.min(v, maxY));
    return padding.top + plotH - (clamped / (maxY - minY)) * plotH;
  };

  // Grade e rótulos
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

  // Linha do valor de partida
  ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const yInit = yForValue(valorInicial);
  ctx.moveTo(padding.left, yInit);
  ctx.lineTo(cssWidth - padding.right, yInit);
  ctx.stroke();
  ctx.setLineDash([]);

  // Faixa abaixo do limite do que a pessoa aguenta perder
  if (resultado.limiteRuim !== undefined) {
    const yLimite = yForValue(resultado.limiteRuim);
    ctx.fillStyle = "rgba(248, 113, 113, 0.07)";
    ctx.fillRect(padding.left, yLimite, plotW, padding.top + plotH - yLimite);
    ctx.strokeStyle = "rgba(248, 113, 113, 0.5)";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left, yLimite);
    ctx.lineTo(cssWidth - padding.right, yLimite);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const desenharSerie = (serie, cor, espessura) => {
    ctx.beginPath();
    ctx.lineWidth = espessura;
    ctx.strokeStyle = cor;
    serie.forEach((v, i) => {
      const x = xForIndex(i, serie.length);
      const y = yForValue(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  // Sem proteção primeiro, apagado, para a proteção ficar por cima.
  amostras.forEach((a) => desenharSerie(a.sem, "rgba(148, 163, 184, 0.28)", 1));
  amostras.forEach((a) =>
    desenharSerie(a.com, a.liquidada ? "rgba(248, 113, 113, 0.6)" : "rgba(74, 141, 248, 0.55)", 1.4)
  );

  ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
  ctx.textAlign = "center";
  ctx.fillText("tempo", cssWidth / 2, cssHeight - 10);
}

function formatCurrencyShort(v) {
  if (v >= 1000000) return "R$" + (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return "R$" + (v / 1000).toFixed(0) + "k";
  return "R$" + Math.round(v);
}
