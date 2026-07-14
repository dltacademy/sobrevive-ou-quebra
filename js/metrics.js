// ============================================================
// Cálculo de métricas do Raio-X a partir de trades canônicos.
// ============================================================

function computeMetrics(trades) {
  if (!trades.length) return null;

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const breakeven = trades.filter((t) => t.pnl === 0);

  const totalPnl = sum(trades.map((t) => t.pnl));
  const totalFees = sum(trades.map((t) => t.fee));
  const grossWin = sum(wins.map((t) => t.pnl));
  const grossLoss = Math.abs(sum(losses.map((t) => t.pnl)));
  const winRate = wins.length / trades.length;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : wins.length ? Infinity : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const realizedRR = avgLoss > 0 ? avgWin / avgLoss : null;

  // fee bleed: quanto das taxas representa perto do resultado bruto movimentado
  const grossMovement = grossWin + grossLoss;
  const feeBleedPct = grossMovement > 0 ? totalFees / grossMovement : 0;

  // drawdown máximo sobre a curva acumulada de pnl líquido
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  trades.forEach((t) => {
    cumulative += t.pnl - t.fee;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  // revenge trading: entrada <30min após um loss, com qty maior que o trade anterior
  let revengeCount = 0;
  for (let i = 1; i < trades.length; i++) {
    const prev = trades[i - 1];
    const cur = trades[i];
    if (prev.pnl >= 0) continue;
    const tPrev = prev.date ? Date.parse(prev.date) : null;
    const tCur = cur.date ? Date.parse(cur.date) : null;
    if (tPrev && tCur) {
      const diffMin = (tCur - tPrev) / 60000;
      if (diffMin >= 0 && diffMin <= 30 && cur.qty > prev.qty) {
        revengeCount++;
      }
    }
  }

  // overtrading: trades por dia
  const byDay = {};
  trades.forEach((t) => {
    const day = t.date ? String(t.date).slice(0, 10) : "sem-data";
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const dayCounts = Object.values(byDay);
  const avgPerDay = dayCounts.length ? sum(dayCounts) / dayCounts.length : 0;
  const maxPerDay = dayCounts.length ? Math.max(...dayCounts) : 0;
  const overtradingDays = dayCounts.filter((c) => c > avgPerDay * 3 && c >= 5).length;

  // viés long/short
  const longs = trades.filter((t) => t.side.includes("LONG") || t.side === "BUY");
  const shorts = trades.filter((t) => t.side.includes("SHORT") || t.side === "SELL");
  const longWinRate = longs.length ? longs.filter((t) => t.pnl > 0).length / longs.length : null;
  const shortWinRate = shorts.length ? shorts.filter((t) => t.pnl > 0).length / shorts.length : null;

  // consistência de position size (coeficiente de variação da qty)
  const qtys = trades.map((t) => t.qty).filter((q) => q > 0);
  const sizeConsistency = qtys.length > 1 ? coefficientOfVariation(qtys) : null;

  // por símbolo
  const bySymbol = {};
  trades.forEach((t) => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { pnl: 0, count: 0 };
    bySymbol[t.symbol].pnl += t.pnl;
    bySymbol[t.symbol].count += 1;
  });
  const symbolRanking = Object.entries(bySymbol)
    .map(([symbol, v]) => ({ symbol, ...v }))
    .sort((a, b) => b.pnl - a.pnl);

  return {
    totalTrades: trades.length,
    winRate,
    profitFactor,
    totalPnl,
    totalFees,
    feeBleedPct,
    avgWin,
    avgLoss,
    realizedRR,
    maxDrawdown,
    revengeCount,
    avgPerDay,
    maxPerDay,
    overtradingDays,
    longCount: longs.length,
    shortCount: shorts.length,
    longWinRate,
    shortWinRate,
    sizeConsistency,
    symbolRanking,
  };
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function coefficientOfVariation(arr) {
  const mean = sum(arr) / arr.length;
  if (mean === 0) return 0;
  const variance = sum(arr.map((v) => (v - mean) ** 2)) / arr.length;
  return Math.sqrt(variance) / mean;
}

/** Gera os 3 principais diagnósticos em texto, ordenados por severidade. */
function buildDiagnosis(m, refDiscountPct) {
  const findings = [];

  if (m.feeBleedPct > 0.08) {
    const savings = m.totalFees * refDiscountPct;
    findings.push({
      severity: m.feeBleedPct > 0.15 ? 3 : 2,
      title: "Taxas estão comendo parte real do seu resultado",
      text: `Você pagou ${formatBRL(m.totalFees)} em taxas nos últimos ${m.totalTrades} trades — isso equivale a ${(m.feeBleedPct * 100).toFixed(1)}% do volume bruto movimentado. Com o cashback vitalício de ~${Math.round(refDiscountPct * 100)}% nas taxas, seriam ~${formatBRL(savings)} a menos — e vale pra sempre, não só nesses trades.`,
    });
  }

  if (m.revengeCount > 0) {
    findings.push({
      severity: m.revengeCount >= 3 ? 3 : 2,
      title: "Padrão de revenge trading detectado",
      text: `${m.revengeCount} trade(s) entraram em até 30min após um loss, com posição MAIOR que a anterior — o padrão clássico de tentar "recuperar rápido" que normalmente aumenta a perda.`,
    });
  }

  if (m.overtradingDays > 0) {
    findings.push({
      severity: 2,
      title: "Dias de overtrading",
      text: `${m.overtradingDays} dia(s) com volume de trades muito acima da sua média (${m.avgPerDay.toFixed(1)}/dia, pico de ${m.maxPerDay}) — geralmente sinal de operar por tédio/ansiedade, não por setup.`,
    });
  }

  if (m.sizeConsistency !== null && m.sizeConsistency > 0.6) {
    findings.push({
      severity: 2,
      title: "Position size inconsistente",
      text: `Seu tamanho de posição varia muito entre trades (coeficiente de variação ${(m.sizeConsistency * 100).toFixed(0)}%) — sinal de que o risco por trade não segue uma regra fixa.`,
    });
  }

  if (m.realizedRR !== null && m.realizedRR < 1 && m.winRate < 0.5) {
    findings.push({
      severity: 3,
      title: "Matemática do jogo não fecha",
      text: `Win rate de ${(m.winRate * 100).toFixed(0)}% com R:R médio de ${m.realizedRR.toFixed(2)} — essa combinação tende a perder dinheiro no longo prazo, independente de "sorte" de curto prazo.`,
    });
  }

  if (m.longWinRate !== null && m.shortWinRate !== null) {
    const diff = Math.abs(m.longWinRate - m.shortWinRate);
    if (diff > 0.2 && m.longCount >= 3 && m.shortCount >= 3) {
      const better = m.longWinRate > m.shortWinRate ? "compras (long)" : "vendas (short)";
      findings.push({
        severity: 1,
        title: "Viés direcional",
        text: `Seu desempenho em ${better} é bem melhor que na direção oposta — vale investigar se é leitura de mercado ou só viés psicológico.`,
      });
    }
  }

  findings.sort((a, b) => b.severity - a.severity);
  return findings.slice(0, 3);
}

function formatBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
