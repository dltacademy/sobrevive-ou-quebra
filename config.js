// ============================================================
// CONFIG — único arquivo que precisa ser editado pra lançar
// ============================================================

const CONFIG = {
  // Link de afiliado padrão (Binance) — usado quando não há ?c= reconhecido
  refDefault: "https://www.binance.com/register?ref=BOSS2026",

  // Um link ref por canal/campanha — regra do doc 10: rastreamento por origem.
  // Chave = valor do parâmetro ?c= na URL. Edite/adicione livremente.
  refByChannel: {
    grupos: "https://www.binance.com/register?ref=BOSS2026",   // grupos Telegram/Discord/WhatsApp orgânico
    whats: "https://www.binance.com/register?ref=BOSS2026",    // status/DM WhatsApp pessoal
    yt: "https://www.binance.com/register?ref=BOSS2026",       // descrição/comentários YouTube
    bio: "https://www.binance.com/register?ref=BOSS2026",      // bio de redes sociais
    "tg-ads": "https://www.binance.com/register?ref=BOSS2026", // posts patrocinados no Telegram (B1)
  },

  // Ofertas usadas pelo roteador. O texto público e a ordem ficam em js/app.js;
  // este arquivo concentra somente destinos e configurações operacionais.
  offers: {
    binance: {
      name: "Binance",
      url: "https://www.binance.com/register?ref=BOSS2026",
      code: "BOSS2026",
    },
    bybit: {
      name: "Bybit",
      url: "https://www.bybit.com/invite?ref=O0YDQDM",
      code: "O0YDQDM",
    },
    etherfi: {
      name: "ether.fi Cash",
      url: "https://www.ether.fi/@e155ee95",
      code: "",
    },
    okx: {
      name: "OKX",
      url: "https://okx.com/en-br/join/30985036",
      code: "30985036",
    },
    kucoin: {
      name: "KuCoin",
      url: "https://www.kucoin.com/r/rf/QBSD5WP6",
      code: "QBSD5WP6",
    },
    mexc: {
      name: "MEXC",
      url: "https://promote.mexc.com/r/602CUJpOyA",
      code: "",
    },
  },

  // Username do Telegram para a consultoria de 20 minutos (sem @, ex: "hyadhuad")
  telegramUsername: "tiagolucer",

  // Código de site do GoatCounter (ex: "meusite" para meusite.goatcounter.com)
  goatCounterSite: "",

  // URL pública final do site (preencher após o deploy — usada nos cards de share)
  siteUrl: "https://sobrevive-ou-quebra.dlt.academy/",

  // Marca
  brand: "dltacademy",
};

function getChannel() {
  const params = new URLSearchParams(window.location.search);
  const channel = params.get("c");
  return channel && /^[A-Za-z0-9_-]{1,40}$/.test(channel) ? channel : null;
}

function getVariant() {
  const params = new URLSearchParams(window.location.search);
  const v = params.get("v");
  return v === "b" ? "b" : "a";
}

function getRefLink() {
  const channel = getChannel();
  if (channel && CONFIG.refByChannel[channel]) {
    return CONFIG.refByChannel[channel];
  }
  return CONFIG.refDefault;
}

function getTelegramLink(prefill) {
  if (!isTelegramConfigured()) return null;
  const base = `https://t.me/${CONFIG.telegramUsername}`;
  return prefill ? `${base}?text=${encodeURIComponent(prefill)}` : base;
}

function isTelegramConfigured() {
  return Boolean(
    CONFIG.telegramUsername &&
    CONFIG.telegramUsername !== "SEU_USUARIO_TELEGRAM"
  );
}

function getOfferLink(offerKey) {
  if (offerKey === "binance") return getRefLink();
  return CONFIG.offers[offerKey] ? CONFIG.offers[offerKey].url : "#";
}
