#!/usr/bin/env python3
"""
Seed `public.problem_beta_videos` with short YouTube "beta" clips for benchmark problems,
so a stuck climber sees how a problem is done. This is the server-side seed half of the
Beta Videos feature (see docs/plans/2026-07-10-001-feat-web-beta-videos-plan.md); user
submissions are a deferred Phase 2.

Pipeline (mirrors import_catalog.py's shape):

    catalog-data/*.json  ->  seed_beta_videos.py  ->  Supabase problem_beta_videos
       (benchmarks)          (YouTube Data API)        (clients read approved rows)

For each benchmark (most-repeated first) it runs one YouTube `search.list`
(`"<name> <board suffix>"`), enriches the top hits with `videos.list` (duration + views),
and keeps the first candidate whose normalized name is a substring of the video title
(the confidence gate validated in the pilots: ~zero wrong matches, misses are just no-match).

Two safety behaviours from the ce-doc-review:
  • Manual-review gate — a DISTINCTIVE name (normalized length >= NAME_MIN_SPECIFIC) is
    auto-approved (`status='approved'`); a SHORT / generic name is held `status='pending'`
    for hand review, because the substring gate can false-match a generic name.
  • Resumable / idempotent — already-seeded problems (source='seed', this board) are fetched
    up front and skipped, so a daily run processes the NEXT --limit unseeded benchmarks and
    picks up where the last left off. The upsert merges on the composite key
    (source_catalog_id, provider, video_id), so re-runs never duplicate. On a YouTube quota
    error (403/429) the run stops cleanly — resume tomorrow.

Boards: seed the DEFAULT board (Mini 2025) first; 2019 Masters is a later run.

Environment
-----------
  YOUTUBE_API_KEY            YouTube Data API v3 key (search costs 100 units; 10k/day free)
  SUPABASE_URL               e.g. https://abcdefgh.supabase.co   (no trailing slash)
  SUPABASE_SERVICE_ROLE_KEY  the project's service_role key (bypasses RLS; never ship it)

Examples
--------
  # seed the next 100 unseeded Mini 2025 benchmarks (default board):
  YOUTUBE_API_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
      python3 scripts/seed_beta_videos.py --board mini2025 --limit 100

  # dry run (offline: no YouTube calls, no quota, no keys) — preview WHICH benchmarks run:
  python3 scripts/seed_beta_videos.py --board mini2025 --limit 20 --dry-run

  # re-validate stored clips and soft-delete dead ones (freshness / seed-rot cleanup):
  SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… YOUTUBE_API_KEY=… \
      python3 scripts/seed_beta_videos.py --revalidate
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
CANDIDATES = 5          # top-N search hits to consider per problem
NAME_MIN_SPECIFIC = 6   # normalized-name length at/above which a match auto-approves
SHORT_MAX_SECS = 60     # <= this = a "Short"

# Board slug (for the catalog-data filename) + the YouTube query suffix climbers actually type.
BOARDS = {
    "mini2025": ("minimoonboard2025", "moonboard mini 2025"),
    "2019":     ("moonboardmasters2019", "moonboard 2019"),
}


# ── helpers shared with the pilot ────────────────────────────────────────────
def strip_symbols(s):
    """Drop emoji / pictographs so the query is a clean search string."""
    return "".join(c for c in (s or "") if ord(c) < 0x2000).strip()


def norm(s):
    """Uppercase, alphanumerics only — for substring confidence matching."""
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def iso_to_secs(d):
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", d or "")
    if not m:
        return None
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + s


class QuotaExhausted(Exception):
    """Raised on a YouTube 403/429 so the caller can stop cleanly and resume later."""


def _yt_get(url, params):
    q = urllib.parse.urlencode(params)
    try:
        with urlopen(f"{url}?{q}", timeout=30) as r:
            return json.load(r)
    except HTTPError as e:
        if e.code in (403, 429):
            raise QuotaExhausted(e.read().decode(errors="replace")[:300]) from e
        raise


# ── YouTube ──────────────────────────────────────────────────────────────────
def search(name, suffix, key):
    q = f"{strip_symbols(name)} {suffix}"
    data = _yt_get(SEARCH_URL, {"part": "snippet", "q": q, "type": "video",
                                "maxResults": CANDIDATES, "key": key})
    return q, [{
        "video_id": it["id"]["videoId"],
        "title": it["snippet"]["title"],
        "channel": it["snippet"]["channelTitle"],
    } for it in data.get("items", []) if it["id"].get("videoId")]


def enrich(cands, key):
    """Attach duration + views (one videos.list call for the whole candidate batch)."""
    if not cands:
        return cands
    ids = ",".join(c["video_id"] for c in cands)
    meta = {it["id"]: it for it in _yt_get(
        VIDEOS_URL, {"part": "contentDetails,statistics", "id": ids, "key": key}
    ).get("items", [])}
    for c in cands:
        it = meta.get(c["video_id"], {})
        secs = iso_to_secs(it.get("contentDetails", {}).get("duration"))
        c["duration_s"] = secs
        c["is_short"] = secs is not None and secs <= SHORT_MAX_SECS
        c["views"] = int(it.get("statistics", {}).get("viewCount") or 0)
    return cands


def pick_match(name, cands):
    """First candidate whose normalized name is a substring of its title, else None."""
    nkey = norm(strip_symbols(name))
    if not nkey:
        return None
    for c in cands:
        if nkey in norm(c["title"]):
            return c
    return None


# ── Supabase (service role) ──────────────────────────────────────────────────
def _sb_headers(key, extra=None):
    h = {"Content-Type": "application/json", "apikey": key, "Authorization": f"Bearer {key}"}
    if extra:
        h.update(extra)
    return h


def seeded_ids(base_url, key):
    """source_catalog_ids already seeded (source='seed') — the resumable checkpoint."""
    url = (f"{base_url}/rest/v1/problem_beta_videos"
           f"?select=source_catalog_id&source=eq.seed")
    req = Request(url, headers=_sb_headers(key, {"Range-Unit": "items", "Range": "0-99999"}))
    with urlopen(req, timeout=60) as r:
        return {row["source_catalog_id"] for row in json.load(r)}


def upsert(base_url, key, rows):
    """Idempotent upsert merging on the composite dedupe key (NOT the random PK)."""
    url = (f"{base_url}/rest/v1/problem_beta_videos"
           f"?on_conflict=source_catalog_id,provider,video_id")
    req = Request(url, data=json.dumps(rows).encode(),
                  headers=_sb_headers(key, {"Prefer": "resolution=merge-duplicates,return=minimal"}),
                  method="POST")
    try:
        with urlopen(req, timeout=120) as r:
            return r.status
    except HTTPError as e:
        sys.exit(f"Upsert failed ({e.code}): {e.read().decode(errors='replace')}")


# ── modes ────────────────────────────────────────────────────────────────────
def board_file(slug, angle, catalog_dir):
    return os.path.join(catalog_dir, f"{slug}_{angle}.json")


def run_seed(args, yt_key, base_url, sb_key):
    slug, suffix = BOARDS[args.board]
    path = board_file(slug, args.angle, os.path.abspath(args.dir))
    if not os.path.exists(path):
        sys.exit(f"No catalog file: {path}")

    benchmarks = [p for p in json.load(open(path))["problems"] if p.get("isBenchmark")]
    benchmarks.sort(key=lambda p: p.get("repeats", 0), reverse=True)

    # A real run always reads the seeded checkpoint. A dry run reads it too WHEN Supabase creds
    # are present (so the preview reflects the true next batch), but falls back to the full list
    # when they're absent — keeping dry-run usable with no keys at all.
    read_db = bool(base_url and sb_key)  # a dry run with no creds skips the DB read entirely
    done = seeded_ids(base_url, sb_key) if (read_db or not args.dry_run) else set()
    todo = [p for p in benchmarks if p["id"] not in done][:args.limit]
    print(f"{args.board} @{args.angle}°: {len(benchmarks)} benchmarks, "
          f"{len(done)} already seeded → processing next {len(todo)} (limit {args.limit})")

    if args.dry_run:
        # Offline preview — no YouTube calls (so zero quota) and no writes. Shows WHICH benchmarks
        # would be fetched, most-repeated first; can't show real video matches without the API.
        note = ("already-seeded excluded via DB" if read_db
                else "no DB creds → not excluding already-seeded")
        print(f"[dry-run] would fetch YouTube betas for these benchmarks "
              f"(no API calls, no quota, no writes; {note}):")
        for i, p in enumerate(todo, 1):
            print(f"  {i:>3}. {p.get('repeats', 0):>5}×  {(p.get('name') or '')[:50]}")
        return

    rows, approved, pending, missed = [], 0, 0, 0
    try:
        for i, p in enumerate(todo, 1):
            name = p.get("name") or ""
            _, cands = search(name, suffix, yt_key)
            best = pick_match(name, enrich(cands, yt_key))
            if not best:
                missed += 1
                print(f"  {i:>3}. ——   {name[:40]}  (no confident match)")
                continue
            # manual-review gate: short/generic names are held pending (substring gate is weak there)
            distinctive = len(norm(strip_symbols(name))) >= NAME_MIN_SPECIFIC
            status = "approved" if distinctive else "pending"
            approved += status == "approved"
            pending += status == "pending"
            rows.append({
                "source_catalog_id": p["id"], "provider": "youtube",
                "video_id": best["video_id"], "title": best["title"],
                "channel": best["channel"], "duration_s": best["duration_s"],
                "is_short": best["is_short"], "views": best["views"],
                "source": "seed", "status": status,
            })
            flag = "OK " if status == "approved" else "REV"
            print(f"  {i:>3}. {flag}  {name[:40]:40} → {best['title'][:44]}")
    except QuotaExhausted as e:
        print(f"\n⚠️  YouTube quota exhausted — stopping cleanly, resume tomorrow. ({e})")

    print(f"\nMatched {len(rows)} ({approved} approved, {pending} held for review), "
          f"{missed} no-match.")
    if not rows:
        return
    if args.dry_run:
        print("[dry-run] not writing to Supabase.")
        return
    upsert(base_url, sb_key, rows)
    print(f"Upserted {len(rows)} beta rows.")


def run_revalidate(args, yt_key, base_url, sb_key):
    """Fetch stored video_ids, check they still exist on YouTube, soft-delete dead ones."""
    url = (f"{base_url}/rest/v1/problem_beta_videos"
           f"?select=id,video_id&provider=eq.youtube&deleted=eq.false")
    req = Request(url, headers=_sb_headers(sb_key, {"Range-Unit": "items", "Range": "0-99999"}))
    with urlopen(req, timeout=60) as r:
        stored = json.load(r)
    print(f"Re-validating {len(stored)} stored clips…")

    alive, dead = set(), []
    try:
        for i in range(0, len(stored), 50):  # videos.list takes up to 50 ids / 1 unit
            chunk = stored[i:i + 50]
            got = _yt_get(VIDEOS_URL, {"part": "id",
                                       "id": ",".join(c["video_id"] for c in chunk),
                                       "key": yt_key})
            alive |= {it["id"] for it in got.get("items", [])}
    except QuotaExhausted as e:
        sys.exit(f"Quota exhausted during revalidate: {e}")
    dead = [c for c in stored if c["video_id"] not in alive]

    print(f"{len(dead)} dead clip(s).")
    if not dead or args.dry_run:
        print("[dry-run] not soft-deleting." if args.dry_run and dead else "Nothing to do.")
        return
    for c in dead:  # soft-delete each dead row by id
        u = f"{base_url}/rest/v1/problem_beta_videos?id=eq.{c['id']}"
        req = Request(u, data=json.dumps({"deleted": True}).encode(),
                      headers=_sb_headers(sb_key, {"Prefer": "return=minimal"}), method="PATCH")
        urlopen(req, timeout=30)
    print(f"Soft-deleted {len(dead)} dead clips.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--board", choices=sorted(BOARDS), default="mini2025",
                    help="which board to seed (default: mini2025 — the app default)")
    ap.add_argument("--angle", type=int, choices=(25, 40), default=40)
    ap.add_argument("--limit", type=int, default=100, help="max problems to process this run")
    ap.add_argument("--dir", default=os.path.join(os.path.dirname(__file__), "..", "catalog-data"))
    ap.add_argument("--dry-run", action="store_true", help="no Supabase writes")
    ap.add_argument("--revalidate", action="store_true",
                    help="check stored clips still exist; soft-delete dead ones")
    args = ap.parse_args()

    yt_key = os.environ.get("YOUTUBE_API_KEY")
    if not yt_key and not args.dry_run:
        # A dry run is offline (no YouTube calls), so it needs no key.
        sys.exit("Set YOUTUBE_API_KEY in the environment (or pass --dry-run).")
    base_url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run and (not base_url or not sb_key):
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or pass --dry-run).")

    if args.revalidate:
        run_revalidate(args, yt_key, base_url, sb_key)
    else:
        run_seed(args, yt_key, base_url, sb_key)


if __name__ == "__main__":
    main()
