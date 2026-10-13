"""Build per-week fantasy score timelines from nflverse play-by-play data.

For every league week this writes `public/score-timelines/<season>/<week>.json`
containing, per manager, the scoring events of all starters with real
timestamps. The Gamecenter matchup page uses these files to draw the score
progression across the NFL week.

Points per play follow the league's scoring rules (inferred from the
official lineup points). Whatever the play-by-play cannot reproduce exactly
(stat corrections, edge cases) is added as one correction event at the end of
the player's game, so every curve ends at the official score.

Usage:
    pip install -r scripts/score_timelines/requirements.txt
    NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
        python scripts/score_timelines/build.py 2015 2016 ... 2025

    # or with a local export of the starters (see load_starters_file)
    python scripts/score_timelines/build.py --starters starters.json 2023
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "score-timelines"
CACHE_DIR = Path(os.environ.get("PBP_CACHE_DIR", ROOT / ".cache" / "pbp"))
PBP_URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.csv.gz"

# Plays more than this far apart start a new game window (e.g. Thu night → Sun)
WINDOW_GAP_SECONDS = 45 * 60

TEAM_ABBR = {
    "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Oakland Raiders": "LV",
    "Los Angeles Chargers": "LAC", "San Diego Chargers": "LAC", "Los Angeles Rams": "LA",
    "St. Louis Rams": "LA", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
    "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
    "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
    "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA", "Tampa Bay Buccaneers": "TB",
    "Tennessee Titans": "TEN", "Washington Commanders": "WAS", "Washington Football Team": "WAS",
    "Washington Redskins": "WAS",
}

# ── Scoring rules ────────────────────────────────────────────────────────────

PASS_YD, PASS_TD, INT = 0.04, 4, -2
RUSH_REC_YD, TD, TWO_PT, FUMBLE_LOST = 0.1, 6, 2, -2

# Kicker scoring: field goals scored in tiers until 2021, by distance since 2022
def kicker_fg_points(season: int):
    if season >= 2022:
        return lambda d: max(3.0, round(d) / 10)
    return lambda d: 3.0 if d < 40 else 4.0 if d < 50 else 5.0


DST_SACK, DST_INT, DST_FUMBLE_REC, DST_TD, DST_SAFETY = 1, 2, 2, 6, 2


def dst_points_allowed(pa: float) -> int:
    if pa <= 0:
        return 10
    if pa <= 6:
        return 7
    if pa <= 13:
        return 4
    if pa <= 20:
        return 1
    if pa <= 27:
        return 0
    if pa <= 34:
        return -1
    return -4


# ── Data loading ─────────────────────────────────────────────────────────────

PBP_COLUMNS = [
    "game_id", "season", "week", "season_type", "play_id", "time_of_day", "home_team", "away_team",
    "posteam", "defteam", "play_type", "desc", "passing_yards", "rushing_yards", "receiving_yards",
    "pass_touchdown", "rush_touchdown", "return_touchdown", "touchdown", "td_team", "td_player_id",
    "interception", "complete_pass", "sack", "safety", "fumble_lost", "fumbled_1_player_id",
    "two_point_conv_result", "field_goal_result", "kick_distance", "extra_point_result",
    "passer_player_id", "rusher_player_id", "receiver_player_id", "kicker_player_id",
    "total_home_score", "total_away_score",
]


def load_pbp(season: int) -> pd.DataFrame:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"play_by_play_{season}.csv.gz"
    if not path.exists():
        print(f"  downloading play-by-play {season} …", file=sys.stderr)
        urllib.request.urlretrieve(PBP_URL.format(season=season), path)
    df = pd.read_csv(path, low_memory=False, usecols=lambda c: c in PBP_COLUMNS)
    df = df[df.season_type == "REG"].copy()
    df["ts"] = pd.to_datetime(df.time_of_day, utc=True, errors="coerce")
    # Fill the few plays without a wall-clock time from their neighbours
    df = df.sort_values(["game_id", "play_id"])
    df["ts"] = df.groupby("game_id").ts.transform(lambda s: s.ffill().bfill())
    df = df[df.ts.notna()]
    df["t"] = (df.ts - pd.Timestamp(0, tz="UTC")).dt.total_seconds().astype(int)
    return df


def load_starters_supabase(seasons: list[int]) -> list[dict]:
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(path: str) -> list[dict]:
        rows, offset = [], 0
        while True:
            req = urllib.request.Request(f"{url}/rest/v1/{path}", headers={**headers, "Range": f"{offset}-{offset + 999}"})
            with urllib.request.urlopen(req) as res:
                batch = json.load(res)
            rows += batch
            if len(batch) < 1000:
                return rows
            offset += 1000

    season_list = ",".join(map(str, seasons))
    lineups = get(
        "weekly_lineups?select=season_year,week,manager_id,slot,player_name,espn_id,points"
        f"&is_starter=eq.true&season_year=in.({season_list})&order=id"
    )
    players = get("players?select=espn_id,gsis_id&espn_id=not.is.null")
    gsis_by_espn = {p["espn_id"]: p["gsis_id"] for p in players}
    return [{**l, "gsis_id": gsis_by_espn.get(l["espn_id"])} for l in lineups]


def load_starters_file(path: str) -> list[dict]:
    """Rows as [season, week, manager, slot, player_name, espn_id, points, gsis_id, position]."""
    keys = ["season_year", "week", "manager_id", "slot", "player_name", "espn_id", "points", "gsis_id"]
    return [dict(zip(keys, row)) for row in json.load(open(path))]


# ── Event extraction ─────────────────────────────────────────────────────────

def offensive_events(df: pd.DataFrame, kicker_rule) -> pd.DataFrame:
    """One row per (play, player) with the fantasy points that play produced."""
    num = lambda c: df[c].fillna(0)
    two_pt = (df.two_point_conv_result == "success").astype(int)
    fg_made = df.field_goal_result == "made"
    fg_pts = num("kick_distance").map(kicker_rule).where(fg_made, 0)
    pass_td = num("pass_touchdown") * (df.td_team == df.posteam)
    other_td = num("touchdown") * ((df.rush_touchdown == 1) | (df.return_touchdown == 1))

    parts = [
        ("passer_player_id", num("passing_yards") * PASS_YD + pass_td * PASS_TD + num("interception") * INT
         + two_pt * (df.play_type == "pass") * TWO_PT),
        ("receiver_player_id", num("receiving_yards") * RUSH_REC_YD + two_pt * (df.play_type == "pass") * TWO_PT),
        ("rusher_player_id", num("rushing_yards") * RUSH_REC_YD + two_pt * (df.play_type == "run") * TWO_PT),
        ("td_player_id", (pass_td + other_td).clip(upper=1) * TD),
        ("fumbled_1_player_id", num("fumble_lost") * FUMBLE_LOST),
        ("kicker_player_id", fg_pts + (df.extra_point_result == "good") * 1.0),
    ]
    frames = []
    for col, pts in parts:
        f = pd.DataFrame({"pid": df[col], "game_id": df.game_id, "week": df.week, "t": df.t, "pts": pts})
        frames.append(f[f.pid.notna() & (f.pts != 0)])
    out = pd.concat(frames)
    return out.groupby(["pid", "game_id", "week", "t"], as_index=False).pts.sum()


def dst_events(game: pd.DataFrame, team: str) -> list[tuple[int, float]]:
    """Running D/ST points for one team in one game, as (t, delta) events."""
    home = game.home_team.iloc[0]
    opp = game.away_team.iloc[0] if team == home else home
    opp_score_col = "total_away_score" if team == home else "total_home_score"
    events: list[tuple[int, float]] = [(int(game.t.min()), float(dst_points_allowed(0)))]
    tier = dst_points_allowed(0)
    opp_def_td = 0
    for row in game.itertuples(index=False):
        pts = 0.0
        if row.defteam == team:
            pts += (row.sack == 1) * DST_SACK + (row.interception == 1) * DST_INT + (row.safety == 1) * DST_SAFETY
        if row.fumble_lost == 1 and row.posteam == opp:
            pts += DST_FUMBLE_REC
        if row.touchdown == 1 and row.td_team == team and row.posteam != team:
            pts += DST_TD
        # Opponent touchdowns scored against this team's offense don't count as points allowed
        if row.touchdown == 1 and row.td_team == opp and row.posteam == team:
            opp_def_td += 1
        score = getattr(row, opp_score_col)
        allowed = (0 if pd.isna(score) else score) - 6 * opp_def_td
        new_tier = dst_points_allowed(allowed)
        pts += new_tier - tier
        tier = new_tier
        if pts:
            events.append((int(row.t), float(pts)))
    return events


def week_windows(times: pd.Series) -> list[list[int]]:
    ts = sorted(set(int(t) for t in times))
    windows = [[ts[0], ts[0]]]
    for t in ts[1:]:
        if t - windows[-1][1] > WINDOW_GAP_SECONDS:
            windows.append([t, t])
        else:
            windows[-1][1] = t
    return windows


def build_season(season: int, starters: list[dict]) -> None:
    print(f"Season {season}", file=sys.stderr)
    df = load_pbp(season)
    starters = [s for s in starters if s["season_year"] == season]
    events = offensive_events(df, kicker_fg_points(season))
    ev_by_player_week = {k: g for k, g in events.groupby(["pid", "week"])}
    games = {k: g for k, g in df.groupby("week")}
    game_end = df.groupby("game_id").t.max()

    by_week: dict[int, list[dict]] = defaultdict(list)
    for s in starters:
        by_week[s["week"]].append(s)

    out_dir = OUT_DIR / str(season)
    out_dir.mkdir(parents=True, exist_ok=True)

    total_pts = corrected_pts = 0.0
    for week, rows in sorted(by_week.items()):
        week_df = games.get(week)
        if week_df is None:
            print(f"  week {week}: no play-by-play, skipped", file=sys.stderr)
            continue
        windows = week_windows(week_df.t)
        week_end = windows[-1][1]
        managers: dict[str, dict] = {}

        for s in rows:
            team = managers.setdefault(s["manager_id"], {"players": [], "events": [], "final": 0.0})
            official = round(float(s["points"] or 0), 2)
            team["final"] = round(team["final"] + official, 2)
            idx = len(team["players"])
            team["players"].append(s["player_name"])

            player_events: list[tuple[int, float]] = []
            end_t = week_end
            if s["slot"] == "DST":
                abbr = TEAM_ABBR.get(s["player_name"])
                game = week_df[(week_df.home_team == abbr) | (week_df.away_team == abbr)] if abbr else None
                if game is not None and len(game):
                    player_events = dst_events(game, abbr)
                    end_t = int(game.t.max())
            else:
                g = ev_by_player_week.get((s["gsis_id"], week))
                if g is not None:
                    player_events = [(int(t), float(p)) for t, p in zip(g.t, g.pts)]
                    end_t = int(game_end[g.game_id.iloc[-1]])

            diff = round(official - sum(p for _, p in player_events), 2)
            total_pts += abs(official)
            if abs(diff) >= 0.01:
                corrected_pts += abs(diff)
                player_events.append((end_t, diff))
            for t, p in player_events:
                if abs(p) >= 0.005:
                    team["events"].append([t - windows[0][0], round(p, 2), idx])

        for team in managers.values():
            team["events"].sort(key=lambda e: e[0])

        base = windows[0][0]
        payload = {
            "season": season,
            "week": week,
            "start": base,
            "windows": [[a - base, b - base] for a, b in windows],
            "managers": managers,
        }
        (out_dir / f"{week}.json").write_text(json.dumps(payload, separators=(",", ":")))
    share = 100 * corrected_pts / total_pts if total_pts else 0
    print(f"  wrote {len(by_week)} weeks, {share:.1f}% of points via end-of-game correction", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("seasons", nargs="+", type=int)
    parser.add_argument("--starters", help="local JSON export of the starters instead of Supabase")
    args = parser.parse_args()
    starters = load_starters_file(args.starters) if args.starters else load_starters_supabase(args.seasons)
    for season in args.seasons:
        build_season(season, starters)


if __name__ == "__main__":
    main()
