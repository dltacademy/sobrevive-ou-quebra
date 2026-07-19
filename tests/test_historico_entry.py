from pathlib import Path
import json
import re
import unittest

from security_check import check_html

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "historico" / "index.html"
JS = ROOT / "js" / "historico.js"
PARSER = ROOT / "js" / "csv-parser.js"


class HistoricoEntryContractTests(unittest.TestCase):
    def test_page_is_noindex_and_private_by_default(self):
        source = HTML.read_text(encoding="utf-8")
        self.assertIn('<meta name="robots" content="noindex">', source)
        self.assertIn('<meta name="referrer" content="no-referrer">', source)
        self.assertIn("Seu CSV fica no navegador", source)

    def test_page_passes_repository_security_checker(self):
        self.assertEqual(check_html(HTML), [])

    def test_page_loads_only_external_executable_scripts(self):
        source = HTML.read_text(encoding="utf-8")
        scripts = re.findall(r"<script([^>]*)>(.*?)</script>", source, flags=re.S)
        for attrs, body in scripts:
            if 'type="application/ld+json"' in attrs:
                json.loads(body)
            else:
                self.assertIn("src=", attrs)
                self.assertFalse(body.strip())

    def test_required_modules_and_campaign_runtime_are_loaded(self):
        source = HTML.read_text(encoding="utf-8")
        expected = [
            "../config.js",
            "../js/csv-parser.js",
            "../js/metrics.js",
            "../js/example-data.js",
            "../js/share-card.js",
            "../js/historico.js",
        ]
        for path in expected:
            self.assertIn(f'src="{path}"', source)

    def test_runtime_preserves_channel_and_variant(self):
        source = JS.read_text(encoding="utf-8")
        self.assertIn('searchParams.set("c", channel)', source)
        self.assertIn('searchParams.set("v", variant)', source)
        self.assertIn("getRefLink()", source)

    def test_runtime_enforces_local_file_limits(self):
        runtime = JS.read_text(encoding="utf-8")
        parser = PARSER.read_text(encoding="utf-8")
        self.assertIn("5 * 1024 * 1024", runtime)
        self.assertIn("MAX_CSV_ROWS = 20000", parser)
        self.assertIn('endsWith(".csv")', runtime)


if __name__ == "__main__":
    unittest.main()
