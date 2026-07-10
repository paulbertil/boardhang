---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: grill-me
execution: code
date: 2026-07-10
---

# Web Beta Videos — Plan

> **Implementation-ready.** Product intent (WHAT) was resolved in a `grill-me` session on
> 2026-07-10, *validated against live YouTube data* (two throwaway pilots — see
> [Pilot evidence](#pilot-evidence--why-scraping-is-the-right-call)). The `ce-plan` HOW is the
> [Implementation Plan](#implementation-plan-how) section. Split into **Phase 1** (benchmark
> seed + read-only display) and **Phase 2** (user submissions + moderation).

## Goal Capsule

- **Objective:** On a problem, show a **Beta videos** section — a horizontal-scroll strip of
  short climbing-beta clips other people filmed — so a climber stuck on a problem can watch how
  it's done. Solve the **cold-start** (nothing to show on day one, no users yet) by
  **pre-seeding** benchmark problems from YouTube via the **official Data API** — starting with
  the app's default board, **Mini MoonBoard 2025** — then let users contribute the long tail later.
- **Product authority:** the user (solo builder of the Boardhang PWA). Decisions below were
  resolved in the 2026-07-10 grill and are backed by pilot data, not assumption.
- **Open blockers:** none for Phase 1. Needs a YouTube Data API key (kept in an env var /
  secret, never committed). Phase 2 needs a moderation surface that does not exist yet, hence
  the phase split.

## Pilot evidence — why "scraping" is the right call

The original question was *scrape vs. only-user-uploaded*. Two throwaway pilots against the live
YouTube Data API (scripts in scratchpad, not committed) settled it with data:

- **Matching works.** Query `"<name> moonboard 2019"` + a confidence gate ("normalized problem
  name ∈ video title") gave **79/80 confident, correct matches** on the top-80 most-repeated
  2019 benchmarks (**98%**). The one miss was a Japanese-named problem (`ポテチ`).
- **Mini 2025 (the default board) is also seedable.** A follow-up probe with the
  `"<name> moonboard mini 2025"` query hit **5/5 confident matches** on the top Mini 2025
  benchmarks — a channel systematically films them. Only the head was checked (quota-limited); the
  tail is unvalidated (see DQ3), and Mini 2025's lower repeats / more-generic names lean harder on
  the R1 manual-review gate.
- **The risk is recall, not precision.** The failure mode is *no match* (non-Latin / generic
  names), never *wrong match*. A miss just means "no video yet" — safe. This inverts the initial
  fear that auto-matching would mislead climbers.
- **The content is Shorts.** 79/79 confident matches were **≤60 s vertical Shorts**. A
  Shorts-first UI isn't a constraint we impose — it's what the beta ecosystem *is*. The only
  long results were multi-problem *compilations* (noise); a Shorts-length bias raises precision.
- **This is not scraping.** We use the **official YouTube Data API** to discover video IDs and
  the **official iframe/thumbnail** to display them — with channel attribution. Instagram is
  deferred (no usable public search API; scraping it would be ToS-hostile).
  ⚠️ **Storage-policy check (pre-ship):** the pilot validated *matching*, not *storage*. Confirm
  the YouTube API Services Developer Policies permit persisting `title`/`channel`/`views`; if not,
  store only `video_id` + `source_catalog_id` and **hydrate title/channel/views at render time**
  (or commit to a documented refresh cadence). See [Deferred / Open Questions](#deferred--open-questions).

**Conclusion:** seed benchmarks from the API for a *warm* cold-start with *correct* videos;
user submissions fill the long tail (Phase 2). Scrape-vs-upload was a false binary — do both.

## Context — what already exists

- **Problem model (`0006`, `web/src/catalog/*`):** `catalog_problems` keyed by
  `source_catalog_id` (UUIDv5, globally unique **across board and angle** — the natural FK for a
  video). Fields include `name`, `grade`, `repeats`, `is_benchmark`, `setter`. Public-read/anon,
  seeded server-side by `scripts/import_catalog.py`; client caches per (`layout_id`, `angle`)
  slab in IndexedDB.
- **Detail surface:** the problem detail is a **drawer** (`web/src/catalog/ProblemDetail.tsx`),
  deep-linkable via `?problem=<source_catalog_id>` (`catalogSearch.ts`,
  `useProblemDrawer.ts`) — so every problem already has a shareable URL. The action buttons
  (Connect & light up, Log try / Log ascent) live at the bottom of the drawer.
- **UGC template to mirror:** `list_problems` (`0003`) — a `source_catalog_id` +
  `added_by` + soft-delete + sync-friendly table. The closest existing shape for
  `problem_beta_videos`.
- **Reusable client pieces:** `components/ui/skeleton.tsx` (loading shimmer);
  `sessions/memberAscentsStore.ts` (on-demand pull + max-age cache pattern) as the store
  template; `supabase/client.ts` (anon read client).
- **Seed tooling precedent:** `scripts/import_catalog.py` — a one-off server-side Python
  importer that upserts into a public-read table. The beta seed is the same shape.

## Product Contract

### Phase 1 — Benchmark seed + read-only display

- **R1 — Seed benchmarks from the official API.** A one-off server-side script queries YouTube
  for benchmark problems and writes confident matches into `problem_beta_videos` as
  `source='seed', status='approved'`. Query = `"<emoji-stripped name> moonboard 2019"`;
  **confidence gate** = normalized problem name (`[^A-Z0-9]` stripped, uppercased) is a
  substring of the normalized video title. **Auto-accepted for distinctive names** — the gate's
  ~98% match rate (with ~zero wrong matches) earns it there. **Short / common-word names fall
  below a specificity threshold and route to mandatory manual review** instead of auto-accept,
  because the substring test can false-match a generic name against an unrelated title. Raw
  candidates are dumped to JSON, and the spot-check is required for any low-specificity name.
- **R2 — Beta section in the drawer.** `ProblemDetail.tsx` gains a **Beta videos** section, a
  **horizontal-scroll** strip of portrait cards, placed at the **very bottom of the drawer,
  below** the Log try / Log ascent buttons. Each card = portrait **thumbnail**
  (`img.youtube.com/vi/<video_id>/hqdefault.jpg`, **zero API quota**) + channel name +
  ▶/duration badge + provider glyph. Note `hqdefault.jpg` is a 480×360 **landscape** frame
  (vertical Shorts are pillarboxed), so the portrait card **object-cover-crops** it; a
  broken/placeholder thumbnail (deleted video) **hides the card** rather than showing a gray box.
- **R3 — Tap → player sheet.** Tapping a card opens a **full-screen player sheet** with a single
  YouTube **iframe** (mounted only on tap — a 5-beta problem is never 5 live players). Matches
  the vertical Shorts viewing experience.
  - **Sheet states:** (a) iframe-loading placeholder over the thumbnail, (b) unavailable /
    embedding-blocked fallback with a **"Watch on YouTube"** out-link (embedding is often
    disabled on Shorts), (c) playing.
  - **Dismissal:** top-left close button + swipe-down + scrim tap; the OS/browser **back gesture
    closes the sheet first**, without popping the `?problem=` drawer or changing the URL.
  - **Single-video for now** — tapping a card views that one clip; a swipeable Shorts-style pager
    across a problem's betas is deferred (see [Deferred / Open Questions](#deferred--open-questions)).
- **R4 — Ordering: most-watched first.** Betas render **`views` desc** — the most-watched clip
  is usually the clearest/canonical beta.
- **R5 — Four explicit states.** The section always renders (advertises the feature, and becomes
  the Phase-2 contribution hook), with:
  1. **Loading** — header + 2–3 shimmer skeleton portrait cards (reuse `ui/skeleton.tsx`).
  2. **Has videos** — the carousel (R2).
  3. **Empty** — a single centered slot. Phase 1: "No beta videos yet." Phase 2: same slot
     becomes the **"＋ Add the first beta"** submit entry (R7).
  4. **Error** — a **distinct** slot from Empty: "Couldn't load beta videos" + a **"Try again"**
     action that re-runs the `betaStore` fetch, so a transient network failure is recoverable in
     place (not indistinguishable from a genuinely video-less problem).

### Phase 2 — User submissions + moderation (deferred)

- **R6 — Submit a beta.** A signed-in user pastes a YouTube (later Instagram) URL on a problem;
  the app extracts the video ID, fetches title/channel/duration via the API, and inserts a row
  with `source='user', status='pending'`.
- **R7 — Review queue (moderation).** Submissions are **hidden until approved** — the display
  query only returns `status='approved'`. The owner (you) approves/rejects from a moderation
  surface (to be designed). This is the safe path chosen over trust-on-submit precisely because
  the confidence gate that protects the seed does **not** protect arbitrary user URLs.
- **R8 — Attribution & dedupe.** Every card credits the channel and links out; a **partial**
  unique index on `(source_catalog_id, provider, video_id) where not deleted` stops the same clip
  being attached twice (seed + user, or two users) while still allowing a removed/rejected clip to
  be re-added later.

### Key technical decisions (KTD)

- **KTD1 — FK is `source_catalog_id`.** A video attaches to one specific (layout, angle) climb.
  ⚠️ **Confirm at build:** `0006`'s header asserts `source_catalog_id` is unique across angles,
  but `fetch_boardsesh.py` has a comment implying a problem's uuid is *stable across angles*.
  This does **not** change the schema (same FK either way) — it only decides whether the 40° seed
  also covers 25° or each angle is seeded separately. Phase-1 pilot used the **40° slab** (the
  standard, most-filmed angle); seed 40° first regardless.
- **KTD2 — Status gate is the trust boundary.** The public display query is *always*
  `status='approved' AND NOT deleted`. Seed rows land approved; user rows land pending. One
  column carries the entire seed-vs-queue distinction — no separate tables.
- **KTD3 — Thumbnails are free, iframes are lazy.** Cards use static thumbnail images (no quota,
  no player weight); an iframe mounts only inside the player sheet on tap. Keeps a
  many-beta drawer cheap on a phone.
- **KTD4 — Seed runs server-side, offline of the app.** The seed is a `import_catalog.py`-style
  one-off that upserts into a public-read table — **not** a live runtime job. No API key ships in
  the client; the client only ever reads `problem_beta_videos` (anon) and hits YouTube's public
  thumbnail/iframe endpoints.

## Implementation Plan (HOW)

### 1. Migration `0010_problem_beta_videos.sql` (Supabase — safety-critical, `effort: max`, test-first)

```
create table public.problem_beta_videos (
  id                uuid        primary key default gen_random_uuid(),
  source_catalog_id text        not null,            -- FK-by-convention to catalog_problems (KTD1)
  provider          text        not null default 'youtube'
                                 check (provider in ('youtube','instagram')),
  video_id          text        not null,
  title             text        not null,
  channel           text        not null,
  duration_s        int,
  is_short          boolean     not null default false,
  views             bigint      not null default 0,
  source            text        not null check (source in ('seed','user')),
  status            text        not null default 'pending'
                                 check (status in ('approved','pending','rejected')),
  added_by          uuid        references auth.users(id),   -- null for seed
  created_at        timestamptz not null default now(),
  deleted           boolean     not null default false
);
-- R8 dedupe as a PARTIAL unique index so a rejected/soft-deleted clip can be re-added later
-- (mirrors 0003's list_problems partial index; a full table constraint would permanently
--  occupy the tuple after a hand-reject or removal).
create unique index on public.problem_beta_videos (source_catalog_id, provider, video_id)
  where not deleted;
create index on public.problem_beta_videos (source_catalog_id) where not deleted;
```

- **RLS:**
  - **Public read** is **approved-only**: `select` policy `status = 'approved' and not deleted`
    (anon). Pending/rejected rows are never anon-readable (KTD2).
  - **Phase 1:** no client write policy at all — seed is written server-side with the service
    role, exactly like `catalog_problems`.
  - **Phase 2:** add an `insert` policy allowing a signed-in user to insert **only**
    `source='user', status='pending', added_by = auth.uid()` (a `with check` clamps all three);
    approve/reject is owner/service-role only. Defer this policy to the Phase-2 migration.
- Follow the repo's manual SQL-Editor apply convention in the migration footer. Test RLS via the
  throwaway-Postgres + auth-stub approach (no local Supabase) per project practice.

### 2. Seed script `scripts/seed_beta_videos.py` (server-side, resumable daily batch)

- Harvest the validated pilot into a real seed. **Parametrized by board + query suffix** (not
  hardcoded): Phase 1 targets the default board **Mini 2025** — reads
  `catalog-data/minimoonboard2025_40.json` with suffix `"moonboard mini 2025"`; **2019 Masters**
  (`moonboardmasters2019_40.json`, suffix `"moonboard 2019"`) is a later run. Filters
  `isBenchmark`, sorts by `repeats`, and for each:
  1. `search.list` (`q="<strip_symbols(name)> <board query suffix>"`, `type=video`, `maxResults=5`).
  2. `videos.list` (`contentDetails,statistics`) for duration + views; tag `is_short = dur ≤ 60`.
  3. Keep the first candidate passing the confidence gate. **Distinctive names auto-accept**
     (`status='approved'`); **short / common-word names are held for manual review** (below the
     specificity threshold — the substring gate can false-match generic titles).
- **Resumable / checkpointed.** The script **tracks which problems are already imported vs.
  pending** (a persisted cursor / `repeats`-rank checkpoint) and processes the **next ~100 per
  run**, so a daily run picks up where the last left off and coverage grows over time without
  redoing work. It also **periodically re-validates stored `video_id`s** and soft-deletes dead
  ones (covers seed rot — deleted / privated videos).
- **Idempotent upsert.** The PK is a random `uuid`, so the upsert must target the composite key
  explicitly (PostgREST `?on_conflict=source_catalog_id,provider,video_id`). This **diverges from
  `import_catalog.py`'s PK-merge**, which would 409 on re-run.
- **Quota:** `search.list` = 100 units; free quota 10,000/day = **100 searches/day** ⇒ one ~100
  per-run batch is a day's quota; ~6 runs cover all 540 benchmarks (or request a quota bump).
  `videos.list` batches up to 50 ids/call (1 unit), so it's negligible. Log what was skipped.
- `YOUTUBE_API_KEY` from env; **never committed**. Reuse the pilot's `strip_symbols`/`norm`
  helpers.

### 3. Client — read store + types (`web/src/beta/`)

- `betaTypes.ts` — `BetaVideo` interface mirroring the approved-readable columns.
- `betaStore.ts` — an on-demand pull modeled on `sessions/memberAscentsStore.ts`: fetch
  `problem_beta_videos` where `source_catalog_id = ?` (anon client, `status='approved'` enforced
  by RLS, `order by views desc`), with a small **per-session in-memory cache** keyed by
  `source_catalog_id` so re-opening a problem is instant. No IndexedDB/offline persistence in v1.

### 4. Client — UI (`web/src/beta/BetaVideos.tsx`, mounted in `ProblemDetail.tsx`)

- `<BetaVideos sourceCatalogId>` rendered at the **bottom** of the drawer, below the action
  buttons (R2). Implements the four states (R5) with `ui/skeleton.tsx` for loading.
- `BetaCard` — portrait thumbnail + channel + duration/▶ + provider glyph; `onClick` opens
  `BetaPlayerSheet` (R3) with a single lazy `<iframe>`. Follow the repo input/style idioms
  (`text-base md:text-sm`; verify with `oxlint` + `tsc -b`/`npm run build`, **never** Prettier).
- Empty/error slots per R5 (Phase 1 copy only; leave a clear seam for the Phase-2 submit CTA).
- **Accessibility:** the player sheet **traps focus and returns it to the originating card** on
  close; each `BetaCard` is a **labelled button** ("Beta by ‹channel›, ‹duration›"); the strip is
  **keyboard-scrollable** with its role/label set.

### 5. Verification

- `npm run build` (= `tsc -b`) + `oxlint` in `web/`. Unit-test `betaStore` (cache + ordering) and
  `BetaVideos` state rendering, matching the `*.test.tsx` neighbors.
- Drive it in the browser (`/ce-test-browser`): open a seeded benchmark (e.g. Easy Does It on
  Mini 2025) → strip shows thumbnails → tap → player sheet plays; open a non-seeded problem →
  empty state; throttle network → skeleton.

## Non-goals (this plan)

- **Instagram ingestion** — deferred (no public search API; ToS-hostile to scrape). Schema
  reserves `provider='instagram'` for later user submissions only.
- **iOS** — web PWA only.
- **Automated discovery of *new* betas** — the seed grows via manual daily runs of the resumable
  script; nothing auto-discovers newly-uploaded betas in v1. (The script *does* re-validate
  existing `video_id`s to drop dead ones — that's liveness, not re-discovery.)
- **Realtime, likes/ranking, comments, playlists** — a flat views-desc strip only.
- **Client-side API calls** — the key never ships; the client only reads the table + public
  thumbnails/iframes.

## Success signals

- Opening a seeded benchmark shows a horizontal strip of correct beta Shorts (views-desc); tapping
  one plays it in a full-screen sheet.
- Opening a non-seeded problem shows the "No beta videos yet" empty state (not a blank/broken
  row); a slow network shows skeleton cards first.
- The seed script populates the top-N benchmarks on the seeded board (Mini 2025 first) at high
  coverage with zero wrong matches, all `status='approved'`; a name the query can't match is
  simply absent (no bad row).
- (Phase 2) A signed-in user submits a URL → row lands `pending` → invisible to the public until
  approved from the moderation surface.

## Outstanding Questions (for build)

- **OQ1 — Angle coverage (KTD1).** Confirm whether `source_catalog_id` is shared or distinct
  across 25°/40° before deciding if the 40° seed covers 25°. Resolve against `fetch_boardsesh.py`
  + a quick `catalog_problems` query at build time.
- **OQ2 — Seed batching & quota.** The resumable script runs ~100-search batches/day (one day's
  quota), checkpointed by `repeats` rank; ~6 runs cover all 540 benchmarks, or request a quota
  bump. Phase 1 can ship with just the top ~80–100 seeded.
- **OQ3 — API key hygiene.** Keep the YouTube Data API key in an env var / secret, never
  committed; restrict it to YouTube Data API v3 and add a referrer/IP restriction.
- **OQ4 — Phase-2 moderation surface.** Where the review queue lives (a hidden admin route? a
  Supabase-dashboard-only flow to start?) is unresolved and intentionally out of Phase 1.
- **OQ5 — Non-Latin / generic names.** The ~2% the query can't match (e.g. `ポテチ`) — accept as
  user-submission long tail, or add a per-problem manual-ID override list in the seed script?

## Deferred / Open Questions

### From 2026-07-10 ce-doc-review

- **DQ1 — User demand unproven** (product-lens). The pilot retired the *technical* risk (98%
  match), not the *demand* risk: is in-app beta wanted vs. climbers' existing YouTube/IG habit?
  Consider a thin instrumented probe (e.g. a "watch beta" deep-link) before investing further.
- **DQ2 — Seeded board** (feasibility). ✅ **Resolved 2026-07-10:** seed the default board
  **Mini 2025 (layout 7)** first — top-5 benchmarks confirmed on YouTube via a dedicated
  benchmark channel; **2019 Masters** is a later run. The seed script is parametrized by board +
  query suffix. Residual: benchmarks are a minority of the catalog, so non-benchmark *projects*
  still show empty (tracked as the Phase-2 user-submission long tail).
- **DQ3 — Auto-accept calibrated on the head** (adversarial). 98% was measured on the top-80
  benchmarks; re-measure precision/recall on a **tail sample** (rank ~300–400) before trusting
  auto-accept beyond the head. Ties to the specificity threshold in R1.
- **DQ4 — Single-video sheet vs Shorts pager** (design-lens). R3 ships **single-video** for now;
  decide whether the sheet becomes a swipeable pager across a problem's betas (a structurally
  different component).
