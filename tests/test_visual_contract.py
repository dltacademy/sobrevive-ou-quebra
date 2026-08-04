from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


class VisualContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = INDEX.read_text(encoding="utf-8")

    def test_canonical_tool_shell_and_assets(self) -> None:
        self.assertTrue((ROOT / "dlt-patterns.css").is_file())
        self.assertTrue((ROOT / "js" / "dlt-interactions.js").is_file())
        self.assertTrue((ROOT / "og-image.svg").is_file())
        self.assertIn('<link rel="stylesheet" href="dlt-patterns.css">', self.html)
        self.assertIn('<script src="js/dlt-interactions.js"></script>', self.html)
        self.assertIn('class="hero tool-head"', self.html)
        self.assertIn('class="subtitle tool-promise"', self.html)
        self.assertIn('class="tool-facts"', self.html)
        self.assertIn('class="privacy-line"', self.html)

    def test_simulator_patterns_preserve_controls_and_actions(self) -> None:
        self.assertIn('class="card calc"', self.html)
        self.assertIn('class="result-hero result-banner"', self.html)
        self.assertIn('class="result-actions"', self.html)
        self.assertIn('data-copy-result="#result-banner"', self.html)
        self.assertIn('id="btn-download-sim-text"', self.html)
        self.assertIn('class="card convert-block cta-verdict"', self.html)
        self.assertIn('class="share-row" data-share', self.html)
        self.assertIn('class="next-step"', self.html)
        self.assertIn('class="affiliate-disclosure" id="convert-disclosure"', self.html)
        self.assertEqual(self.html.count('class="stat-box"'), 6)
        self.assertNotRegex(self.html, r"[⚠️📥📋]")
        self.assertNotIn("{{CATEGORIA}}", (ROOT / "og-image.svg").read_text(encoding="utf-8"))

    def test_primary_result_has_three_support_boxes(self) -> None:
        match = re.search(r'<div class="stat-row result-stats three-stat-grid">(.*?)</div>\s*\n\s*<div class="result-actions">', self.html, re.DOTALL)
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1).count('class="stat-box"'), 3)


if __name__ == "__main__":
    unittest.main()
