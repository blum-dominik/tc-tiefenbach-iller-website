"""
fetch_all_teams.py
------------------
Wrapper that calls fetch_match_days for every configured TC Tiefenbach/Iller team
and writes one combined txt file plus individual files per team.

Usage:
    python .github/scripts/fetch_all_teams.py
    python .github/scripts/fetch_all_teams.py --output-dir results/
"""

import argparse
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

# Add the scripts folder to the path so fetch_match_days can be imported directly
sys.path.insert(0, str(Path(__file__).parent))
from fetch_match_days import fetch_match_days, write_output  # noqa: E402

# ---------------------------------------------------------------------------
# Team registry – add or remove entries here as needed
# ---------------------------------------------------------------------------
TEAMS: list[dict] = [
    {"teamid": 3578170, "label": "Damen I"},
    {"teamid": 3644190, "label": "Damen II"},
    {"teamid": 3621170, "label": "Herren 30"},
    {"teamid": 3582084, "label": "Knaben 15"},
    {"teamid": 3582977, "label": "Bambini 12"},
]
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch BTV match days for all TC Tiefenbach/Iller teams."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent,
        help="Directory to write output files into (default: same folder as this script)",
    )
    parser.add_argument(
        "--combined",
        type=Path,
        default=None,
        help="Optional path for a single combined output file",
    )
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    today = date.today().strftime("%d.%m.%Y")
    all_lines: list[str] = [
        f"TC Tiefenbach/Iller – Alle Spieltermine (Stand: {today})",
        "=" * 60,
        "",
    ]

    results: list[tuple[dict, list[dict], str]] = []

    for team in TEAMS:
        teamid = team["teamid"]
        label = team["label"]
        print(f"Fetching {label} (teamid={teamid}) …", end=" ", flush=True)

        try:
            fixtures, header = fetch_match_days(teamid)
        except Exception as exc:
            print(f"FAILED – {exc}")
            continue

        print(f"{len(fixtures)} fixture(s) found")

        # Write individual file
        slug = label.lower().replace(" ", "_").replace("/", "_")
        individual_path = args.output_dir / f"match_days_{slug}.txt"
        write_output(fixtures, header, teamid, individual_path)

        results.append((team, fixtures, header))

    # Build combined output
    combined_path = args.combined or (args.output_dir / "match_days_all_teams.txt")

    col_w = (12, 21, 34, 30, 6)

    def row(a, b, c, d, e):
        return f"{a:<{col_w[0]}}  {b:<{col_w[1]}}  {c:<{col_w[2]}}  {d:<{col_w[3]}}  {e}"

    separator = "  ".join("-" * w for w in col_w)

    all_lines.append(row("Team", "Datum", "Heimmannschaft", "Gastmannschaft", "Status"))
    all_lines.append(separator)

    # Flatten and sort by date+time (DD.MM.YYYY, HH:MM → sortable as YYYY-MM-DD HH:MM)
    all_fixtures = [
        (team["label"], fx)
        for team, fixtures, _header in results
        for fx in fixtures
    ]

    def sort_key(item: tuple) -> str:
        ds = item[1]["date_str"]  # e.g. "So. 03.05.2026, 10:00"
        # extract "03.05.2026, 10:00" → "2026-05-03 10:00"
        parts = ds.split(" ", 1)[1]          # "03.05.2026, 10:00"
        date_part, time_part = parts.split(", ")
        d, m, y = date_part.split(".")
        return f"{y}-{m}-{d} {time_part}"

    for label, fx in sorted(all_fixtures, key=sort_key):
        all_lines.append(row(label, fx["date_str"], fx["home"], fx["away"], fx["status"]))

    combined_path.write_text("\n".join(all_lines) + "\n", encoding="utf-8")
    total = sum(len(fx) for _, fx, _ in results)
    print(f"\nCombined file: {combined_path} ({total} fixture(s) across {len(results)} team(s))")

    # Write weekend overview
    weekend_path = args.output_dir / "match_days_weekend_overview.txt"
    write_weekend_overview(all_fixtures, weekend_path)
    print(f"Weekend overview: {weekend_path}")


_DAY_NAMES = {
    "Mo.": "Montag",
    "Di.": "Dienstag",
    "Mi.": "Mittwoch",
    "Do.": "Donnerstag",
    "Fr.": "Freitag",
    "Sa.": "Samstag",
    "So.": "Sonntag",
}


def format_date(date_str: str) -> str:
    """'So. 03.05.2026, 10:00' → 'Sonntag, 03.05.2026, 10:00 Uhr'"""
    abbr, rest = date_str.split(" ", 1)
    return f"{_DAY_NAMES.get(abbr, abbr)}, {rest} Uhr"


def parse_date(date_str: str) -> datetime:
    """Parse 'So. 03.05.2026, 10:00' into a datetime."""
    parts = date_str.split(" ", 1)[1]          # "03.05.2026, 10:00"
    date_part, time_part = parts.split(", ")
    return datetime.strptime(f"{date_part} {time_part}", "%d.%m.%Y %H:%M")


def write_weekend_overview(all_fixtures: list[tuple], output_path: Path) -> None:
    """
    Group fixtures by ISO calendar week and write a Heimspiele / Auswärtsspiele
    overview per weekend block.
    """
    # Group by ISO year+week
    weeks: dict[tuple, list[tuple]] = defaultdict(list)
    for label, fx in all_fixtures:
        dt = parse_date(fx["date_str"])
        iso = dt.isocalendar()          # (year, week, weekday)
        weeks[(iso[0], iso[1])].append((dt, label, fx))

    today = date.today().strftime("%d.%m.%Y")
    lines = [
        f"TC Tiefenbach/Iller – Spieltermine nach Wochenende (Stand: {today})",
        "=" * 60,
    ]

    for (year, week) in sorted(weeks):
        entries = sorted(weeks[(year, week)], key=lambda x: x[0])

        # Determine weekend date range label (first and last date in this group)
        first_dt = entries[0][0]
        last_dt = entries[-1][0]
        if first_dt.date() == last_dt.date():
            range_label = first_dt.strftime("%d.%m.%Y")
        else:
            range_label = f"{first_dt.strftime('%d.%m.')} – {last_dt.strftime('%d.%m.%Y')}"

        lines.append(f"\n{'─' * 50}")
        lines.append(f"Wochenende {range_label}  (KW {week})")
        lines.append(f"{'─' * 50}")

        heim = [(dt, label, fx) for dt, label, fx in entries if "Tiefenbach" in fx["home"]]
        ausw = [(dt, label, fx) for dt, label, fx in entries if "Tiefenbach" in fx["away"]]

        if heim:
            lines.append("Heimspiele:")
            for dt, label, fx in heim:
                opponent = fx["away"]
                lines.append(format_date(fx['date_str']))
                lines.append(f"{label} gegen {opponent}")

        if ausw:
            lines.append("Auswärtsspiele:")
            for dt, label, fx in ausw:
                opponent = fx["home"]
                lines.append(format_date(fx['date_str']))
                lines.append(f"{label} bei {opponent}")

    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
