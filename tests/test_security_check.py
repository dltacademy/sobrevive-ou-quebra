from __future__ import annotations

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "security_check.py"
SPEC = importlib.util.spec_from_file_location("security_check", CHECKER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Não foi possível carregar {CHECKER_PATH}")
SECURITY_CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SECURITY_CHECK)

VALID_CSP = "; ".join(SECURITY_CHECK.REQUIRED_CSP)


def page(body: str = "", *, csp: str = VALID_CSP, referrer: str = "no-referrer") -> str:
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta http-equiv="Content-Security-Policy" content="{csp}">
  <meta name="referrer" content="{referrer}">
</head>
<body>{body}</body>
</html>
"""


class SecurityCheckTests(unittest.TestCase):
    def check(self, html: str) -> list[str]:
        with tempfile.TemporaryDirectory() as temporary_directory:
            source = Path(temporary_directory) / "index.html"
            source.write_text(html, encoding="utf-8")
            return SECURITY_CHECK.check_html(source)

    def run_checker(self, root: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(CHECKER_PATH), str(root)],
            capture_output=True,
            text=True,
        )

    def assert_error_contains(self, errors: list[str], fragment: str) -> None:
        self.assertTrue(
            any(fragment in error for error in errors),
            f"Esperava erro contendo {fragment!r}; recebi {errors!r}",
        )

    def test_valid_json_ld_is_allowed(self) -> None:
        errors = self.check(
            page(
                '<script type="application/ld+json">'
                '{"@context":"https://schema.org","@type":"WebApplication"}'
                "</script>"
            )
        )
        self.assertEqual([], errors)

    def test_json_ld_type_is_normalized_safely(self) -> None:
        errors = self.check(
            page('<script type="  APPLICATION/LD+JSON  ">{"ok":true}</script>')
        )
        self.assertEqual([], errors)

    def test_malformed_json_ld_is_rejected(self) -> None:
        errors = self.check(
            page('<script type="application/ld+json">{"broken":}</script>')
        )
        self.assert_error_contains(errors, "JSON-LD inválido")

    def test_non_finite_constants_are_rejected(self) -> None:
        for constant in ("NaN", "Infinity", "-Infinity"):
            with self.subTest(constant=constant):
                errors = self.check(
                    page(
                        '<script type="application/ld+json">'
                        f'{{"value": {constant}}}'
                        "</script>"
                    )
                )
                self.assert_error_contains(errors, "constante não permitida")

    def test_finite_numbers_are_allowed(self) -> None:
        errors = self.check(
            page(
                '<script type="application/ld+json">'
                '{"value":1.5e308,"negative":-0.25}'
                "</script>"
            )
        )
        self.assertEqual([], errors)

    def test_empty_json_ld_is_rejected(self) -> None:
        errors = self.check(page('<script type="application/ld+json"> </script>'))
        self.assert_error_contains(errors, "bloco JSON-LD vazio")

    def test_unclosed_json_ld_is_rejected(self) -> None:
        errors = self.check(
            page('<script type="application/ld+json">{"ok":true}')
        )
        self.assert_error_contains(errors, "bloco JSON-LD sem fechamento")

    def test_classic_inline_javascript_is_rejected(self) -> None:
        errors = self.check(page("<script>window.alert('no')</script>"))
        self.assert_error_contains(errors, "JavaScript executável inline")

    def test_module_inline_is_rejected(self) -> None:
        errors = self.check(page('<script type="module">export default 1</script>'))
        self.assert_error_contains(errors, "JavaScript executável inline")

    def test_importmap_inline_is_rejected(self) -> None:
        errors = self.check(
            page('<script type="importmap">{"imports":{}}</script>')
        )
        self.assert_error_contains(errors, "JavaScript executável inline")

    def test_speculation_rules_inline_is_rejected(self) -> None:
        errors = self.check(
            page('<script type="speculationrules">{"prefetch":[]}</script>')
        )
        self.assert_error_contains(errors, "JavaScript executável inline")

    def test_unknown_inline_type_is_rejected(self) -> None:
        errors = self.check(page('<script type="x-unknown">payload</script>'))
        self.assert_error_contains(errors, "JavaScript executável inline")

    def test_script_smuggling_inside_json_ld_is_rejected(self) -> None:
        errors = self.check(
            page(
                '<script type="application/ld+json">'
                '{"value":"</script><script>alert(1)</script>"}'
                "</script>"
            )
        )
        self.assert_error_contains(errors, "JSON-LD inválido")
        self.assert_error_contains(errors, "JavaScript executável inline")

    def test_external_script_is_allowed(self) -> None:
        errors = self.check(page('<script src="js/app.js"></script>'))
        self.assertEqual([], errors)

    def test_csp_is_still_required(self) -> None:
        errors = self.check(page(csp="default-src 'self'"))
        self.assert_error_contains(errors, "CSP sem script-src")

    def test_unsafe_csp_directives_are_rejected(self) -> None:
        for directive in ("unsafe-inline", "unsafe-eval"):
            with self.subTest(directive=directive):
                errors = self.check(page(csp=f"{VALID_CSP}; '{directive}'"))
                self.assert_error_contains(errors, "CSP contém diretiva insegura")

    def test_referrer_policy_is_still_required(self) -> None:
        errors = self.check(page(referrer="origin"))
        self.assert_error_contains(errors, "meta referrer deve ser no-referrer")

    def test_external_link_protections_are_still_required(self) -> None:
        errors = self.check(page('<a href="https://example.com" target="_blank">x</a>'))
        self.assert_error_contains(errors, "noopener")
        self.assert_error_contains(errors, "referrerpolicy=no-referrer")

    def test_unpinned_action_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            workflow = root / ".github" / "workflows" / "test.yml"
            workflow.parent.mkdir(parents=True)
            workflow.write_text("steps:\n  - uses: actions/checkout@v4\n", encoding="utf-8")
            errors = SECURITY_CHECK.check_workflows(root)
        self.assert_error_contains(errors, "Action não fixada por SHA completo")

    def test_root_scan_does_not_include_nested_html(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "index.html").write_text(page(), encoding="utf-8")
            nested = root / "nested"
            nested.mkdir()
            (nested / "index.html").write_text(
                page("<script>alert(1)</script>"), encoding="utf-8"
            )
            result = self.run_checker(root)
        self.assertEqual(0, result.returncode, msg=result.stdout)

    def test_cli_returns_nonzero_for_invalid_root_html(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "index.html").write_text(
                page("<script>alert(1)</script>"), encoding="utf-8"
            )
            result = self.run_checker(root)
        self.assertEqual(1, result.returncode)
        self.assertIn("JavaScript executável inline", result.stdout)

    def test_real_repository_passes(self) -> None:
        result = self.run_checker(REPO_ROOT)
        self.assertEqual(0, result.returncode, msg=result.stdout)
        self.assertIn("Security check: OK", result.stdout)


if __name__ == "__main__":
    unittest.main()
