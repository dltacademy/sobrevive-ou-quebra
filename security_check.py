#!/usr/bin/env python3
"""Verificação estática local de segurança do Sobrevive ou Quebra."""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


SECURITY_POLICY_VERSION = "2026-10-07"

REQUIRED_CSP = (
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
)

# Scripts, estilos e fontes saem só do próprio site: nada de CDN, Google Fonts
# ou script de analytics de terceiros com acesso ao DOM das calculadoras.
SELF_ONLY_DIRECTIVES = ("script-src", "style-src", "font-src")

# Hosts que já estiveram na política e não podem voltar. GoatCounter, quando
# ligado, entra só pelo host exato da conta (ex.: dltacademy.goatcounter.com)
# em connect-src e img-src; o script é servido de js/vendor/.
FORBIDDEN_CSP_HOSTS = ("gc.zgo.at", "fonts.googleapis.com", "fonts.gstatic.com")


def parse_csp(policy: str) -> dict[str, list[str]]:
    directives: dict[str, list[str]] = {}
    for part in policy.split(";"):
        tokens = part.split()
        if tokens:
            directives.setdefault(tokens[0].lower(), tokens[1:])
    return directives


def check_csp_sources(path: Path, policy: str) -> list[str]:
    errors: list[str] = []
    directives = parse_csp(policy)
    for name in SELF_ONLY_DIRECTIVES:
        sources = directives.get(name)
        if sources is not None and sources != ["'self'"]:
            errors.append(f"{path}: CSP {name} deve ser só 'self'")
    for name, sources in directives.items():
        for source in sources:
            if "*" in source:
                errors.append(f"{path}: CSP {name} com curinga ({source})")
            if any(host in source for host in FORBIDDEN_CSP_HOSTS):
                errors.append(f"{path}: CSP {name} com host proibido ({source})")
    return errors


class SecurityHTMLParser(HTMLParser):
    def __init__(self, source: Path) -> None:
        super().__init__(convert_charrefs=True)
        self.source = source
        self.errors: list[str] = []
        self.csp: str | None = None
        self.referrer: str | None = None
        self._json_ld_parts: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        if tag == "meta":
            if values.get("http-equiv", "").lower() == "content-security-policy":
                self.csp = values.get("content")
            if values.get("name", "").lower() == "referrer":
                self.referrer = values.get("content")
        if tag == "script" and not values.get("src"):
            script_type = values.get("type", "").strip().lower()
            if script_type == "application/ld+json":
                self._json_ld_parts = []
            else:
                self.errors.append(
                    f"{self.source}: JavaScript executável inline não permitido"
                )
        if tag == "a" and values.get("target") == "_blank":
            rel = set(values.get("rel", "").split())
            missing = {"noopener", "noreferrer"} - rel
            if missing:
                self.errors.append(
                    f"{self.source}: link target=_blank sem {', '.join(sorted(missing))}"
                )
            if values.get("referrerpolicy") != "no-referrer":
                self.errors.append(
                    f"{self.source}: link target=_blank sem referrerpolicy=no-referrer"
                )

    def handle_data(self, data: str) -> None:
        if self._json_ld_parts is not None:
            self._json_ld_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._json_ld_parts is not None:
            self._validate_json_ld()

    def finish(self) -> None:
        if self._json_ld_parts is not None:
            self.errors.append(f"{self.source}: bloco JSON-LD sem fechamento")
            self._json_ld_parts = None

    def _validate_json_ld(self) -> None:
        raw_json = "".join(self._json_ld_parts or []).strip()
        self._json_ld_parts = None
        if not raw_json:
            self.errors.append(f"{self.source}: bloco JSON-LD vazio")
            return
        try:
            json.loads(raw_json, parse_constant=_reject_non_finite)
        except json.JSONDecodeError as error:
            self.errors.append(
                f"{self.source}: JSON-LD inválido "
                f"(linha {error.lineno}, coluna {error.colno}): {error.msg}"
            )
        except ValueError as error:
            self.errors.append(f"{self.source}: JSON-LD inválido: {error}")


def _reject_non_finite(value: str) -> None:
    raise ValueError(f"constante não permitida ({value})")


def check_html(path: Path) -> list[str]:
    parser = SecurityHTMLParser(path)
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    parser.finish()
    errors = parser.errors
    if not parser.csp:
        errors.append(f"{path}: CSP ausente")
    else:
        for directive in REQUIRED_CSP:
            if directive not in parser.csp:
                errors.append(f"{path}: CSP sem {directive}")
        if "unsafe-inline" in parser.csp or "unsafe-eval" in parser.csp:
            errors.append(f"{path}: CSP contém diretiva insegura")
        errors.extend(check_csp_sources(path, parser.csp))
    if parser.referrer != "no-referrer":
        errors.append(f"{path}: meta referrer deve ser no-referrer")
    return errors


def check_workflows(root: Path) -> list[str]:
    errors: list[str] = []
    for path in (root / ".github" / "workflows").glob("*.yml"):
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            match = re.search(r"\buses:\s*[^@\s]+@([^\s#]+)", line)
            if match and not re.fullmatch(r"[0-9a-f]{40}", match.group(1)):
                errors.append(f"{path}:{line_no}: Action não fixada por SHA completo")
    return errors


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    errors: list[str] = []
    for path in sorted(root.glob("*.html")):
        errors.extend(check_html(path))
    errors.extend(check_workflows(root))
    if errors:
        print("Security check falhou:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Security check: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
