# Score timelines

`build.py` creates the data for the "Punkteverlauf" chart on the Gamecenter
matchup page. For every league week it reads the nflverse play-by-play data
(https://github.com/nflverse/nflverse-data/releases/tag/pbp) and the starters
from `weekly_lineups`, computes the fantasy points of every play with a real
timestamp and writes `public/score-timelines/<season>/<week>.json`.

```bash
pip install -r scripts/score_timelines/requirements.txt
export NEXT_PUBLIC_SUPABASE_URL=...
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
python scripts/score_timelines/build.py 2025        # one or more seasons
```

Re-run it after new weeks have been imported, then commit the JSON files.
Downloaded play-by-play files are cached in `.cache/pbp/`.

Scoring (non-PPR): 0.04/pass yd, 4/pass TD, -2/INT, 0.1/rush+rec yd, 6/TD,
2/2-pt, -2/fumble lost, PAT 1. Field goals: 3/4/5 points (0-39/40-49/50+)
until 2021, max(3, 0.1 × distance) since 2022. D/ST: sack 1, INT 2, fumble
recovery 2, TD 6, safety 2, points allowed 10/7/4/1/0/-1/-4. Anything the
play-by-play can't reproduce exactly is added as a correction at the end of the
player's game, so each curve ends at the official score.
