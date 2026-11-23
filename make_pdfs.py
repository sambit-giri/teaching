"""Make the PDF of each slide deck, for the PDF links on the lecture lists.

    python make_pdfs.py                     every deck
    python make_pdfs.py 07-parameters ...   only these decks

Each PDF is saved next to its deck as slides.pdf: the print layout of reveal.js (?print-pdf), light
theme, one page per slide with all clicks shown, as the deck's own PDF button gives. Run it after
changing a deck, and commit the PDF with the deck.

Needs Playwright with its Chromium: pip install playwright && python -m playwright install chromium
"""
import functools
import http.server
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
DECKS = sorted(ROOT.glob("*/lectures/*/index.html"))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main(names):
    decks = [d for d in DECKS if not names or d.parent.name in names]
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        for deck in decks:
            rel = deck.parent.relative_to(ROOT).as_posix()
            page.goto(f"{base}/{rel}/?print-pdf", wait_until="networkidle")
            # wait for reveal's print layout and the fonts, then give the widgets time to draw
            page.wait_for_selector(".pdf-page", state="attached")
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(3000)
            failed = page.locator("text=widget failed").count()
            out = deck.parent / "slides.pdf"
            page.pdf(path=out, prefer_css_page_size=True, print_background=True)
            pages = page.locator(".pdf-page").count()
            note = f", {failed} widget(s) FAILED" if failed else ""
            print(f"{out.relative_to(ROOT)}: {pages} pages, {out.stat().st_size / 1e6:.1f} MB{note}")
        browser.close()
    server.shutdown()


if __name__ == "__main__":
    main(sys.argv[1:])
