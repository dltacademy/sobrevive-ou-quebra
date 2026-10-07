// Regressões estruturais de privacidade e publicação: o que vai ao ar, de onde
// vêm scripts e fontes, e o que os eventos de analytics podem carregar.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

// Monta e confere _site numa pasta temporária, como o deploy faz.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "montar-site-"));
const site = path.join(tmp, "_site");
execFileSync("bash", [path.join(root, "scripts", "montar_site.sh"), site], { stdio: "pipe" });

function servedFiles(dir = site) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? servedFiles(full) : [full];
  });
}
const served = servedFiles().map((full) => path.relative(site, full));
const servedText = (relative) => fs.readFileSync(path.join(site, relative), "utf8");

// Comentários podem citar um host (ex.: de onde o vendor foi baixado); só o código conta.
function stripComments(source, ext) {
  if (ext === ".html") return source.replace(/<!--[\s\S]*?-->/g, "");
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return ext === ".js" ? noBlocks.replace(/^\s*\/\/.*$/gm, "") : noBlocks;
}

// Motivo: publicar a raiz expunha README, documentos .md, checkers .py e testes no ar.
const pages = read(".github/workflows/pages.yml");
assert.match(pages, /path: _site\s*$/m, "pages.yml precisa publicar _site");
assert.doesNotMatch(pages, /path: \.\s*$/m, "pages.yml não pode publicar a raiz");
assert.match(pages, /scripts\/montar_site\.sh --conferir _site/);
for (const relative of served) {
  assert.doesNotMatch(relative, /\.(md|py|mjs|sh|yml)$/, `arquivo interno publicado: ${relative}`);
  assert.doesNotMatch(relative, /(^|\/)(\.|tests\/|scripts\/|dev\/|node_modules\/)/, `pasta interna publicada: ${relative}`);
}
assert.ok(served.includes("index.html"));

// Motivo: fonte do Google e script do CDN do GoatCounter mandam o IP do visitante para terceiros.
const THIRD_PARTY = /fonts\.googleapis\.com|fonts\.gstatic\.com|gc\.zgo\.at/;
for (const relative of served.filter((file) => /\.(html|css|js)$/.test(file))) {
  const code = stripComments(servedText(relative), path.extname(relative));
  assert.doesNotMatch(code, THIRD_PARTY, `${relative} referencia host de terceiro`);
}
const fonts = served.filter((file) => file.startsWith("assets/fonts/") && file.endsWith(".woff2"));
assert.equal(fonts.length, 4, "Sora e Manrope (latin e latin-ext) servidas pelo próprio site");

// Motivo: script-src com host externo reabre a porta para script de terceiro com acesso ao DOM.
const configSource = read("config.js");
const siteMatch = configSource.match(/goatCounterSite:\s*"([^"]*)"/);
assert.ok(siteMatch, "config.js precisa declarar goatCounterSite");
const goatHost = siteMatch[1] ? `https://${siteMatch[1]}.goatcounter.com` : null;
for (const relative of served.filter((file) => file.endsWith(".html"))) {
  const csp = servedText(relative).match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(csp, `${relative} sem CSP`);
  const directives = Object.fromEntries(
    csp[1].split(";").map((part) => part.trim().split(/\s+/)).filter((parts) => parts[0]).map(([name, ...sources]) => [name, sources])
  );
  for (const name of ["script-src", "style-src", "font-src"]) {
    assert.deepEqual(directives[name], ["'self'"], `${relative}: ${name} deve ser só 'self'`);
  }
  assert.doesNotMatch(csp[1], /\*/, `${relative}: CSP com curinga`);
  const expectedConnect = goatHost ? ["'self'", goatHost] : ["'self'"];
  assert.deepEqual(directives["connect-src"], expectedConnect, `${relative}: connect-src`);
  if (!goatHost) assert.doesNotMatch(csp[1], /goatcounter/, `${relative}: CSP libera analytics desligado`);
  else assert.ok(directives["img-src"].includes(goatHost), `${relative}: img-src sem ${goatHost}`);
}
if (goatHost) assert.ok(served.includes("js/vendor/goatcounter-count.js"), "GoatCounter ligado exige o script local");

// Motivo: nome de evento com valor escolhido ou derivado das respostas vaza a resposta para o analytics.
const ALLOWED_IDS = new Set(["offerKey", "linkId"]);
function trackArguments(source) {
  const args = [];
  const pattern = /\btrack\(/g;
  let match;
  while ((match = pattern.exec(source))) {
    if (/function\s+$/.test(source.slice(Math.max(0, match.index - 12), match.index))) continue;
    let depth = 1;
    let quote = null;
    let i = pattern.lastIndex;
    for (; i < source.length && depth > 0; i += 1) {
      const char = source[i];
      if (quote) {
        if (char === "\\") i += 1;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
    }
    args.push(source.slice(pattern.lastIndex, i - 1).trim());
  }
  return args;
}
function identifiersOf(arg) {
  const ids = [];
  const rest = arg
    .replace(/`([^`]*)`/g, (_, body) => {
      for (const expression of body.matchAll(/\$\{([^}]*)\}/g)) ids.push(...(expression[1].match(/[A-Za-z_$][\w$.]*/g) || []));
      return " ";
    })
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, " ");
  ids.push(...(rest.match(/[A-Za-z_$][\w$.]*/g) || []));
  return ids;
}
const badEvents = (source) => trackArguments(source).filter((arg) => identifiersOf(arg).some((id) => !ALLOWED_IDS.has(id)));
assert.deepEqual(badEvents('track("x_" + resposta); track(`y_${offerKey}`); track(a ? "b" : "c");'), ['"x_" + resposta', 'a ? "b" : "c"']);
let trackCalls = 0;
for (const relative of served.filter((file) => file.endsWith(".js") && !file.startsWith("js/vendor/"))) {
  const code = stripComments(servedText(relative), ".js");
  trackCalls += trackArguments(code).length;
  assert.deepEqual(badEvents(code), [], `${relative}: evento com variável que não é id de oferta/link`);
}
assert.ok(trackCalls > 0, "nenhuma chamada track() encontrada");

// Motivo: o link compartilhado levava ?c=, ?v= e outros parâmetros de quem compartilhou.
if (served.includes("js/dlt-interactions.js")) {
  assert.doesNotMatch(servedText("js/dlt-interactions.js"), /location\.href/);
}

// Motivo: toda página precisa apontar para a política de privacidade do portal.
for (const relative of served.filter((file) => file.endsWith(".html"))) {
  const footer = servedText(relative).match(/<footer[\s\S]*?<\/footer>/);
  assert.ok(footer && footer[0].includes('href="https://dlt.academy/privacidade/"'), `${relative}: rodapé sem Privacidade`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Privacidade e publicação: OK — ${served.length} arquivos no ar, ${trackCalls} eventos revisados`);
