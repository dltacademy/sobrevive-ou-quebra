#!/usr/bin/env bash
# Monta em _site/ só o que a ferramenta serve e confere o resultado.
#
# O deploy do GitHub Pages publica esta pasta, não o repositório inteiro:
# README, documentos de padrão (.md), checkers (.py), testes e configuração
# local ficam fora do ar.
#
# Uso:
#   scripts/montar_site.sh [destino]              monta e confere (padrão: _site)
#   scripts/montar_site.sh --montar [destino]     só monta
#   scripts/montar_site.sh --conferir [destino]   só confere
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="tudo"
case "${1:-}" in
  --montar) MODE="montar"; shift ;;
  --conferir) MODE="conferir"; shift ;;
esac
DEST="${1:-$ROOT/_site}"
case "$DEST" in /*) ;; *) DEST="$PWD/$DEST" ;; esac

# Tipos que o navegador recebe. Outro tipo só entra aqui se uma página o usar.
EXTENSOES="html css js png jpg jpeg webp gif svg ico avif woff2 woff xml txt webmanifest"

# Pastas que nunca vão ao ar (além de qualquer pasta ou arquivo com ponto).
PASTAS_FORA="tests dev node_modules scripts _site"

# Arquivos servíveis por extensão, mas que nenhuma página usa: o exemplo de
# configuração e a arte-fonte da imagem de compartilhamento (o site usa o PNG).
ARQUIVOS_FORA=( 'config.example.js' 'og-image.svg' )

montar() {
  case "$DEST" in
    "$ROOT"|"$ROOT/"|/) echo "Destino inválido: $DEST" >&2; exit 1 ;;
  esac
  rm -rf "$DEST"
  mkdir -p "$DEST"

  local prune=( -name '.*' )
  local pasta
  for pasta in $PASTAS_FORA; do prune+=( -o -name "$pasta" ); done

  local tipos=( )
  local ext
  for ext in $EXTENSOES; do
    [ ${#tipos[@]} -gt 0 ] && tipos+=( -o )
    tipos+=( -name "*.$ext" )
  done

  local total=0 rel padrao fora
  while IFS= read -r -d '' arquivo; do
    rel="${arquivo#./}"
    fora=0
    for padrao in "${ARQUIVOS_FORA[@]}"; do
      # shellcheck disable=SC2254
      case "$rel" in $padrao) fora=1 ;; esac
    done
    [ "$fora" -eq 1 ] && continue
    mkdir -p "$DEST/$(dirname "$rel")"
    cp "$arquivo" "$DEST/$rel"
    total=$((total + 1))
  done < <(cd "$ROOT" && find . -mindepth 1 \( -type d \( "${prune[@]}" \) -prune \) -o \( -type f ! -name '.*' \( "${tipos[@]}" \) -print0 \))

  if [ -f "$ROOT/CNAME" ]; then
    cp "$ROOT/CNAME" "$DEST/CNAME"
    total=$((total + 1))
  fi
  echo "Site montado em $DEST: $total arquivos."
}

conferir() {
  if [ ! -d "$DEST" ]; then
    echo "Pasta $DEST não existe; rode a montagem antes." >&2
    exit 1
  fi
  python3 - "$DEST" "$PASTAS_FORA" <<'PY'
"""Confere a pasta publicada: nada interno e nenhuma referência local quebrada."""
from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

site = Path(sys.argv[1]).resolve()
pastas_fora = set(sys.argv[2].split())
erros = []

# O domínio próprio (CNAME) conta como local: canonical e links absolutos
# para a própria ferramenta também precisam existir em _site.
cname = site / "CNAME"
dominio = cname.read_text(encoding="utf-8").strip() if cname.is_file() else ""

for path in sorted(site.rglob("*")):
    rel = path.relative_to(site)
    if any(parte.startswith(".") for parte in rel.parts):
        erros.append(f"arquivo ou pasta oculta publicada: {rel}")
    elif pastas_fora & set(rel.parts):
        erros.append(f"pasta interna publicada: {rel}")
    elif path.is_file() and path.suffix in {".md", ".py", ".sh", ".yml", ".yaml", ".mjs"}:
        erros.append(f"arquivo interno publicado: {rel}")

ATRIBUTOS = {"a": ("href",), "link": ("href",), "img": ("src", "srcset"), "script": ("src",),
             "source": ("src", "srcset"), "iframe": ("src",), "video": ("src", "poster"),
             "audio": ("src",), "use": ("href",)}
URL_CSS = re.compile(r"url\(\s*(['\"]?)([^'\")]+)\1\s*\)")
IMPORT_CSS = re.compile(r"@import\s+(['\"])([^'\"]+)\1")


class Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[str] = []

    def handle_starttag(self, tag, attrs):
        valores = {k.lower(): (v or "") for k, v in attrs}
        for nome in ATRIBUTOS.get(tag, ()):
            valor = valores.get(nome, "").strip()
            if not valor:
                continue
            if nome == "srcset":
                self.refs.extend(parte.strip().split()[0] for parte in valor.split(",") if parte.strip())
            else:
                self.refs.append(valor)
        estilo = valores.get("style", "")
        self.refs.extend(m.group(2).strip() for m in URL_CSS.finditer(estilo))


def destino(base: Path, ref: str) -> Path | None:
    """Arquivo local apontado pela referência, ou None se ela sai do site."""
    if ref.startswith(("#", "mailto:", "tel:", "data:", "javascript:", "blob:")):
        return None
    partes = urlsplit(ref)
    if partes.scheme or partes.netloc:
        if not dominio or partes.netloc != dominio:
            return None
    caminho = unquote(partes.path)
    if not caminho:
        return None
    if caminho.startswith("/"):
        alvo = site / caminho.lstrip("/")
    else:
        alvo = base / caminho
    if caminho.endswith("/") or alvo.is_dir():
        alvo = alvo / "index.html"
    return alvo


def confere(origem: Path, refs: list[str]) -> None:
    for ref in refs:
        alvo = destino(origem.parent, ref)
        if alvo is None:
            continue
        alvo = alvo.resolve()
        if site not in alvo.parents and alvo != site:
            erros.append(f"{origem.relative_to(site)}: referência fora do site: {ref}")
        elif not alvo.is_file():
            erros.append(f"{origem.relative_to(site)}: referência sem arquivo em _site: {ref}")


for pagina in sorted(site.rglob("*.html")):
    parser = Links()
    parser.feed(pagina.read_text(encoding="utf-8"))
    confere(pagina, parser.refs)

for folha in sorted(site.rglob("*.css")):
    texto = re.sub(r"/\*.*?\*/", "", folha.read_text(encoding="utf-8"), flags=re.DOTALL)
    refs = [m.group(2).strip() for m in URL_CSS.finditer(texto)]
    refs += [m.group(2).strip() for m in IMPORT_CSS.finditer(texto)]
    confere(folha, refs)

if erros:
    print("Conferência de _site falhou:")
    print(*[f"- {erro}" for erro in erros], sep="\n")
    sys.exit(1)
paginas = len(list(site.rglob("*.html")))
print(f"Conferência de _site: OK ({paginas} páginas, sem arquivo interno, referências locais resolvidas).")
PY
}

case "$MODE" in
  montar) montar ;;
  conferir) conferir ;;
  tudo) montar; conferir ;;
esac
