"""
fetch_match_days.py
-------------------
Fetches match days for a BTV team portrait page and writes them to a txt file.

Usage:
    python fetch_match_days.py --teamid 3578170 --output match_days.txt

Requirements:
    pip install playwright
    playwright install chromium

The BTV team portrait page loads fixture data inside a ZK-framework iframe,
so a real browser (Playwright) is needed to execute the JavaScript and render
the content before scraping.
"""

import argparse
import re
from datetime import date
from pathlib import Path

from playwright.sync_api import sync_playwright


def fetch_match_days(teamid: int) -> list[dict]:
    """
    Open the BTV team portrait page for the given teamid and scrape all
    fixture rows from the embedded widget iframe.

    Returns a list of dicts with keys:
        date_str, home, away, status
    """
    url = f"https://www.btv.de/de/spielbetrieb/teamportrait.html?teamid={teamid}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle", timeout=30_000)

        # Wait for the ZK iframe widget to render fixture rows
        iframe_locator = page.frame_locator('iframe[src*="btvteamportrait"]')
        # The fixture container becomes visible once ZK has rendered
        iframe_locator.locator("text=SPIELTERMINE").wait_for(timeout=30_000)

        # Extract team / league header
        header = iframe_locator.locator(".slick-active").first.text_content(timeout=5_000) or ""
        header = " ".join(header.split())

        # Collect all fixture rows
        # Each row is a generic container with 4 children: date, home, away, status
        row_selector = (
            "xpath=//div[contains(@class,'z-listcell') or not(@class)]"
            "[.//*[contains(text(),'So.') or contains(text(),'Sa.')]]"
        )

        # inner_text() respects block-level elements and inserts newlines,
        # unlike text_content() which concatenates all text nodes with no separators.
        body_text = iframe_locator.locator("body").inner_text(timeout=10_000)

        browser.close()

    return _parse_fixtures(body_text), header.strip()


def _parse_fixtures(text: str) -> list[dict]:
    """
    Parse fixture lines from the raw body text of the widget iframe.

    Expected pattern (repeating):
        So. DD.MM.YYYY, HH:MM  <home>  <away>  <status>
    """
    fixtures = []
    # Strip lines, drop blank / nbsp-only separators
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln and ln != "\xa0"]

    date_re = re.compile(r"^((?:Mo|Di|Mi|Do|Fr|Sa|So)\. \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2})$")
    status_re = re.compile(r"^(OFFEN|ABGESAGT|WERTUNG|\d+:\d+)$")

    i = 0
    while i < len(lines):
        m = date_re.match(lines[i])
        if not m:
            i += 1
            continue

        date_str = m.group(1)
        # Next two lines are home and away, then status
        if i + 3 < len(lines):
            home = lines[i + 1]
            away = lines[i + 2]
            status_candidate = lines[i + 3]
            if status_re.match(status_candidate):
                fixtures.append({
                    "date_str": date_str,
                    "home": home,
                    "away": away,
                    "status": status_candidate,
                })
                i += 4
                continue
        i += 1

    return fixtures


def write_output(fixtures: list[dict], header: str, teamid: int, output_path: Path) -> None:
    today = date.today().strftime("%d.%m.%Y")
    source_url = f"https://www.btv.de/de/spielbetrieb/teamportrait.html?teamid={teamid}"

    col_w = (21, 34, 30, 6)

    def row(a, b, c, d):
        return f"{a:<{col_w[0]}}  {b:<{col_w[1]}}  {c:<{col_w[2]}}  {d}"

    separator = "  ".join("-" * w for w in col_w)

    lines = [
        header or f"BTV Team {teamid}",
        f"Quelle: {source_url}",
        f"Abgerufen: {today}",
        "",
        "SPIELTERMINE",
        "=" * 12,
        "",
        row("Datum", "Heimmannschaft", "Gastmannschaft", "Status"),
        separator,
    ]

    for fx in fixtures:
        lines.append(row(fx["date_str"], fx["home"], fx["away"], fx["status"]))

    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(fixtures)} fixture(s) to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch BTV match days for a team.")
    parser.add_argument("--teamid", type=int, required=True, help="BTV team ID (e.g. 3578170)")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("match_days.txt"),
        help="Output file path (default: match_days.txt)",
    )
    args = parser.parse_args()

    fixtures, header = fetch_match_days(args.teamid)

    if not fixtures:
        print("No fixtures found. The page may still be loading or the team ID is incorrect.")
        raise SystemExit(1)

    write_output(fixtures, header, args.teamid, args.output)


if __name__ == "__main__":
    main()
