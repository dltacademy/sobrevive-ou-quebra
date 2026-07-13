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

  // Username do Telegram para a chamada de 15min (sem @, ex: "hyadhuad")
  telegramUsername: "SEU_USUARIO_TELEGRAM",

  // Código de site do GoatCounter (ex: "meusite" para meusite.goatcounter.com)
  goatCounterSite: "",

  // URL pública final do site (preencher após o deploy — usada nos cards de share)
  siteUrl: "https://dltacademy.github.io/sobrevive-ou-quebra/",

  // Marca
  brand: "dltacademy",
};

function getChannel() {
  const params = new URLSearchParams(window.location.search);
  return params.get("c") || null;
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
  const base = `https://t.me/${CONFIG.telegramUsername}`;
  return prefill ? `${base}?text=${encodeURIComponent(prefill)}` : base;
}
