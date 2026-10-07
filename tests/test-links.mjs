// Links de indicação: canal (?c=) e oferta só resolvem chave própria e HTTPS.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const configSource = fs.readFileSync(new URL("../config.js", import.meta.url), "utf8");

function load(search) {
  const sandbox = { URL, URLSearchParams, window: { location: { search } } };
  vm.runInNewContext(
    `${configSource}\nglobalThis.__LINKS__ = { CONFIG, getRefLink, getOfferLink };`,
    sandbox
  );
  return sandbox.__LINKS__;
}

// Motivo: com ?c=constructor o href virava o código-fonte de Object (sem own-property nem HTTPS).
const proto = load("?c=constructor");
assert.equal(proto.getRefLink(), proto.CONFIG.refDefault);
assert.equal(load("?c=__proto__").getRefLink(), proto.CONFIG.refDefault);
assert.equal(proto.getOfferLink("constructor"), "#");
assert.equal(proto.getOfferLink("toString"), "#");

// Motivo: destino configurado fora de HTTPS não pode virar CTA.
const links = load("");
links.CONFIG.refDefault = "javascript:alert(1)";
assert.equal(links.getRefLink(), "#");
links.CONFIG.offers.bybit = { url: "http://exemplo.com/ref" };
assert.equal(links.getOfferLink("bybit"), "#");

for (const key of Object.keys(proto.CONFIG.refByChannel || {})) {
  assert.match(load(`?c=${key}`).getRefLink(), /^https:\/\//, `canal ${key}`);
}
for (const key of Object.keys(proto.CONFIG.offers)) {
  assert.match(proto.getOfferLink(key), /^https:\/\//, `oferta ${key}`);
}

console.log("Links de indicação: OK — chave própria e HTTPS em canal e oferta");
