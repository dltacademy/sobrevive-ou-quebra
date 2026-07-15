// ============================================================
// Simulador "Sobrevive ou Quebra?" — Monte Carlo client-side
// Nenhum dado sai do navegador; tudo roda em JS puro.
// ============================================================

// Hipótese educacional: ~0,05% por perna. Não representa uma tabela vigente
// nem inclui funding, slippage, manutenção de margem ou liquidação.
const TAKER_FEE = 0.0005;

/**
 * Roda 1 sequência de N trades e retorna a curva de equity + se quebrou.
 * @param {object} p - {bankroll, leverage, riskPct, winRate, rr, numTrades}
 */
function runOneSequence(p) {
  const { bankroll: initial, leverage, riskPct, winRate, rr, numTrades } = p;
  let bankroll = initial;
  const equity = [bankroll];
  let ruinedAt = null;

  for (let i = 0; i < numTrades; i++) {
    if (bankroll <= initial * 0.01) {
      // considera "quebrado" quando sobra <=1% da banca inicial (não opera com pó)
      ruinedAt = ruinedAt === null ? i : ruinedAt;
      equity.push(bankroll);
      continue;
    }

    const riskAmount = bankroll * riskPct;
    const notional = riskAmount * leverage;
    const fee = notional * TAKER_FEE * 2; // entrada + saída

    const isWin = Math.random() < winRate;
    if (isWin) {
      bankroll += riskAmount * rr - fee;
    } else {
      bankroll -= riskAmount + fee;
    }
    if (bankroll < 0) bankroll = 0;
    equity.push(bankroll);
  }

  return { equity, ruined: ruinedAt !== null, ruinedAt };
}

/**
 * Roda `numSims` simulações e agrega estatísticas.
 */
function runMonteCarlo(params, numSims = 1000) {
  const results = [];
  let ruinCount = 0;
  const ruinTrades = [];
  const finalBalances = [];

  for (let s = 0; s < numSims; s++) {
    const r = runOneSequence(params);
    results.push(r);
    if (r.ruined) {
      ruinCount++;
      ruinTrades.push(r.ruinedAt);
    }
    finalBalances.push(r.equity[r.equity.length - 1]);
  }

  finalBalances.sort((a, b) => a - b);
  const median = finalBalances[Math.floor(finalBalances.length / 2)];
  const p10 = finalBalances[Math.floor(finalBalances.length * 0.1)];
  const p90 = finalBalances[Math.floor(finalBalances.length * 0.9)];

  const avgRuinTrade = ruinTrades.length
    ? Math.round(ruinTrades.reduce((a, b) => a + b, 0) / ruinTrades.length)
    : null;

  // Amostra de curvas pra desenhar (não desenha as 1000 — pesado e ilegível)
  const sampleSize = Math.min(40, results.length);
  const step = Math.floor(results.length / sampleSize) || 1;
  const sampleCurves = [];
  for (let i = 0; i < results.length; i += step) {
    sampleCurves.push(results[i]);
  }

  return {
    ruinRate: ruinCount / numSims,
    avgRuinTrade,
    median,
    p10,
    p90,
    sampleCurves,
    numSims,
  };
}
