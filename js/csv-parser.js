// ============================================================
// Parser de CSV genérico (aspas, vírgulas dentro de campo, ; ou ,)
// + auto-detecção de colunas (aliases Binance/Bybit conhecidos)
// + fallback de mapeamento manual pra qualquer outro formato.
// Tudo roda no navegador — nenhum arquivo é enviado a servidor.
// ============================================================

const MAX_CSV_ROWS = 20000;
const MAX_CSV_COLUMNS = 100;

function parseCSV(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delimiter) {
        row.push(field);
        if (row.length > MAX_CSV_COLUMNS) {
          return { headers: [], rows: [], error: "too_many_columns" };
        }
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.length > MAX_CSV_COLUMNS) {
          return { headers: [], rows: [], error: "too_many_columns" };
        }
        if (row.some((f) => f.trim() !== "")) rows.push(row);
        if (rows.length > MAX_CSV_ROWS + 1) {
          return { headers: [], rows: [], error: "too_many_rows" };
        }
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > MAX_CSV_COLUMNS) {
      return { headers: [], rows: [], error: "too_many_columns" };
    }
    if (row.some((f) => f.trim() !== "")) rows.push(row);
    if (rows.length > MAX_CSV_ROWS + 1) {
      return { headers: [], rows: [], error: "too_many_rows" };
    }
  }

  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).map((r) => {
    const obj = Object.create(null);
    headers.forEach((h, idx) => (obj[h] = (r[idx] || "").trim()));
    return obj;
  });
  return { headers, rows: dataRows, error: null };
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  return semiCount > commaCount ? ";" : ",";
}

// Aliases conhecidos (Binance Futures / Bybit exports) por campo canônico.
// Comparação é case-insensitive e ignora espaços/underscores.
const FIELD_ALIASES = {
  date: ["date(utc)", "date", "time", "created time", "trade time", "datetime", "closed time"],
  symbol: ["symbol", "contracts", "pair", "market"],
  side: ["side", "direction", "position side"],
  qty: ["quantity", "qty", "size", "amount", "filled qty"],
  price: ["price", "avg price", "entry price", "avg entry price"],
  pnl: ["realized profit", "realised pnl", "closed pnl", "realized pnl", "pnl", "profit"],
  fee: ["commission", "fee", "fees", "trading fee"],
};

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[\s_]+/g, " ").trim();
}

/** Retorna { field: headerName|null } com o melhor palpite por coluna. */
function autoDetectMapping(headers) {
  const normalized = headers.map(normalizeHeader);
  const mapping = {};
  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    let found = null;
    for (const alias of aliases) {
      const idx = normalized.findIndex((h) => h === alias || h.includes(alias));
      if (idx !== -1) {
        found = headers[idx];
        break;
      }
    }
    mapping[field] = found;
  });
  return mapping;
}

/**
 * Converte linhas brutas + mapeamento em trades canônicos:
 * { date, symbol, side, qty, price, pnl, fee }
 * Linhas sem pnl válido são descartadas (fills sem resultado, ex. transferências).
 */
function toCanonicalTrades(rows, mapping) {
  const trades = [];
  for (const r of rows) {
    const pnlRaw = mapping.pnl ? r[mapping.pnl] : null;
    const pnl = parseNumber(pnlRaw);
    if (pnl === null) continue; // sem pnl = não é um trade fechado

    trades.push({
      date: mapping.date ? r[mapping.date] : null,
      symbol: mapping.symbol ? r[mapping.symbol] : "N/A",
      side: mapping.side ? (r[mapping.side] || "").toUpperCase() : "N/A",
      qty: mapping.qty ? parseNumber(r[mapping.qty]) || 0 : 0,
      price: mapping.price ? parseNumber(r[mapping.price]) || 0 : 0,
      pnl,
      fee: mapping.fee ? Math.abs(parseNumber(r[mapping.fee]) || 0) : 0,
    });
  }
  // ordena por data quando disponível (pra detecção de revenge trading)
  trades.sort((a, b) => {
    const ta = a.date ? Date.parse(a.date) : 0;
    const tb = b.date ? Date.parse(b.date) : 0;
    return (ta || 0) - (tb || 0);
  });
  return trades;
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const cleaned = String(v).replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}
