// ============================================================
// CSV de exemplo sintético (formato Binance Futures Trade History)
// Usado no botão "ver com dados de exemplo" — sem precisar exportar nada.
// Gerado com padrões propositais: fee bleed alto, revenge trading,
// 1 dia de overtrading — pra demonstrar o diagnóstico completo.
// ============================================================

function generateExampleCSV() {
  const rows = [
    ["Date(UTC)", "Symbol", "Side", "Price", "Quantity", "Realized Profit", "Commission"],
  ];

  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  let day = new Date("2026-06-15T09:00:00Z");
  const addRow = (dateObj, symbol, side, price, qty, pnl, fee) => {
    rows.push([
      dateObj.toISOString().replace("T", " ").slice(0, 19),
      symbol,
      side,
      price.toFixed(2),
      qty.toFixed(3),
      pnl.toFixed(2),
      fee.toFixed(2),
    ]);
  };

  let t = new Date(day);
  // sequência normal de trades espaçados, mistura de win/loss
  const pattern = [
    { win: true, qty: 0.02 },
    { win: false, qty: 0.02 },
    { win: true, qty: 0.02 },
    { win: false, qty: 0.02 },
    { win: false, qty: 0.02 },
    // revenge trading: loss seguido de entrada rápida com size maior
    { win: false, qty: 0.05, revengeGap: 8 },
    { win: false, qty: 0.08, revengeGap: 5 },
    { win: true, qty: 0.02 },
    { win: true, qty: 0.02 },
    { win: false, qty: 0.02 },
  ];

  pattern.forEach((p, i) => {
    const symbol = symbols[i % symbols.length];
    const price = 60000 + Math.random() * 2000;
    const pnl = p.win ? 15 + Math.random() * 25 : -(12 + Math.random() * 30);
    const notional = price * p.qty;
    const fee = notional * 0.0005 * 2;
    addRow(t, symbol, p.win ? "BUY" : "SELL", price, p.qty, pnl, fee);
    const gapMin = p.revengeGap !== undefined ? p.revengeGap : 120 + Math.random() * 200;
    t = new Date(t.getTime() + gapMin * 60000);
  });

  // dia de overtrading (muitos trades pequenos em sequência)
  let overDay = new Date("2026-06-20T10:00:00Z");
  for (let i = 0; i < 14; i++) {
    const symbol = symbols[i % symbols.length];
    const price = 60000 + Math.random() * 2000;
    const win = Math.random() > 0.55;
    const pnl = win ? 5 + Math.random() * 10 : -(6 + Math.random() * 12);
    const qty = 0.015;
    const fee = price * qty * 0.0005 * 2;
    addRow(overDay, symbol, win ? "BUY" : "SELL", price, qty, pnl, fee);
    overDay = new Date(overDay.getTime() + (15 + Math.random() * 20) * 60000);
  }

  return rows.map((r) => r.join(",")).join("\n");
}
