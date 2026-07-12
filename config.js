// ============================================================
// CONFIG — único arquivo que precisa ser editado pra lançar
// ============================================================

const CONFIG = {
  // Link de afiliado padrão (Binance) — usado quando não há ?c= reconhecido
  refDefault: "https://accounts.binance.com/register?ref=SEU_REF_AQUI",

  // Um link ref por canal/campanha — regra do doc 10: rastreamento por origem.
  // Chave = valor do parâmetro ?c= na URL. Edite/adicione livremente.
  refByChannel: {
    grupos: "https://accounts.binance.com/register?ref=SEU_REF_AQUI",   // grupos Telegram/Discord/WhatsApp orgânico
    whats: "https://accounts.binance.com/register?ref=SEU_REF_AQUI",    // status/DM WhatsApp pessoal
    yt: "https://accounts.binance.com/register?ref=SEU_REF_AQUI",       // descrição/comentários YouTube
    bio: "https://accounts.binance.com/register?ref=SEU_REF_AQUI",      // bio de redes sociais
    "tg-ads": "https://accounts.binance.com/register?ref=SEU_REF_AQUI", // posts patrocinados no Telegram (B1)
  },

  // Username do Telegram para a chamada de 15min (sem @, ex: "hyadhuad")
  telegramUsername: "SEU_USUARIO_TELEGRAM",

  // Código de site do GoatCounter (ex: "meusite" para meusite.goatcounter.com)
  goatCounterSite: "",

  // URL pública final do site (preencher após o deploy — usada nos cards de share)
  siteUrl: "https://tiagolucer.github.io/sobrevive-ou-quebra/",

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
