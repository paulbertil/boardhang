-- 0010_problem_beta_videos.sql
-- Beta videos: short climbing-beta clips (YouTube) attached to a catalog problem, shown
-- as a horizontal strip at the bottom of the problem-detail drawer. Solves the cold-start
-- by PRE-SEEDING benchmark problems from the official YouTube Data API (server-side, via
-- scripts/seed_beta_videos.py); user submissions are a deferred Phase 2.
-- (See docs/plans/2026-07-10-001-feat-web-beta-videos-plan.md.)
--
-- Scope (this migration = storage + RLS only; Phase 2's user-submission INSERT policy and
-- the moderation surface are a LATER migration): one table, keyed by source_catalog_id, so
-- a clip attaches to one specific (layout, angle) climb — the same natural key
-- ascents/list_problems/catalog_problems already use.
--
-- Trust model (the load-bearing bit):
--   • PUBLIC read, but APPROVED-ONLY: `status = 'approved' and not deleted`. This is the
--     second `to anon` table after catalog_problems (0006) — a strip must render logged-out.
--     Pending/rejected rows are NEVER anon-readable; the status column is the entire
--     seed-vs-moderation-queue boundary, no separate tables.
--   • NO client write policy in Phase 1. The seed runs with the SERVICE-ROLE key, which
--     bypasses RLS (exactly like scripts/import_catalog.py against catalog_problems). The
--     client only ever SELECTs.
--   • Phase 2 (deferred) adds an INSERT policy clamping a signed-in user to
--     source='user', status='pending', added_by = auth.uid() — so submissions land invisible
--     until moderated. Not in this migration.
--
-- Dedupe is a PARTIAL unique index (…where not deleted), NOT a table constraint: a clip that
-- was rejected or soft-removed can be re-added later (mirrors 0003's list_problems partial
-- index). A full constraint would permanently occupy the (problem, provider, video) tuple.
--
-- Not part of the offline high-water-mark sync spine (like lists/0003): the client fetches a
-- problem's betas on demand, so there is no updated_at cursor — just created_at + a `deleted`
-- tombstone for soft-removal (dead-video cleanup + Phase-2 moderation).

-- ─────────────────────────────────────────────────────────────────────────────
-- problem_beta_videos: one approved (or pending) beta clip for a catalog problem.
-- source_catalog_id is FK-by-convention to catalog_problems.source_catalog_id (not a hard
-- FK: the catalog is server-distributed and a beta may outlive a catalog re-import; the
-- opaque id is the join key, same posture as ascents/list_problems).
create table if not exists public.problem_beta_videos (
    id                uuid        primary key default gen_random_uuid(),
    source_catalog_id text        not null,
    provider          text        not null default 'youtube'
                                  check (provider in ('youtube', 'instagram')),
    video_id          text        not null,
    title             text        not null default '',
    channel           text        not null default '',
    duration_s        int,
    is_short          boolean     not null default false,
    views             bigint      not null default 0,
    source            text        not null check (source in ('seed', 'user')),
    status            text        not null default 'pending'
                                  check (status in ('approved', 'pending', 'rejected')),
    added_by          uuid        references auth.users (id) on delete set null,  -- null for seed
    created_at        timestamptz not null default now(),
    deleted           boolean     not null default false
);

comment on table public.problem_beta_videos is
    'Beta videos (YouTube) per catalog problem. Public read is approved-only (status gate); seed rows land approved via the service role, Phase-2 user rows land pending. Soft-deleted via `deleted`.';

-- Dedupe: a given clip appears at most once (live) per problem+provider. Partial so a
-- rejected/removed clip can be re-added later (see header).
create unique index if not exists problem_beta_videos_dedupe_key
    on public.problem_beta_videos (source_catalog_id, provider, video_id)
    where not deleted;

-- Hot read path: the strip fetches one problem's approved betas, best-viewed first.
create index if not exists problem_beta_videos_read_idx
    on public.problem_beta_videos (source_catalog_id, views desc)
    where status = 'approved' and not deleted;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: world-readable but APPROVED-ONLY. No client writes in Phase 1 (service-role seeds
-- bypass RLS). The `to anon, authenticated` select is deliberate — a beta strip renders
-- before sign-in, like the catalog (0006).
alter table public.problem_beta_videos enable row level security;

create policy "Anyone reads approved beta videos"
    on public.problem_beta_videos for select to anon, authenticated
    using (status = 'approved' and not deleted);

-- No INSERT/UPDATE/DELETE policy: writes are service-role only until Phase 2 adds the
-- user-submission INSERT policy (source='user', status='pending', added_by = auth.uid()).

-- ─────────────────────────────────────────────────────────────────────────────
-- Manual step (no SQL equivalent): apply this migration to the Supabase project
-- (SQL Editor → paste + Run, or `supabase db push`), then seed it with
-- `scripts/seed_beta_videos.py` (Mini 2025 first). See docs/social-accounts-login-SETUP.md
-- and docs/plans/2026-07-10-001-feat-web-beta-videos-plan.md.
-- ─────────────────────────────────────────────────────────────────────────────
