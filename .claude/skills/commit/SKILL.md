---
name: commit
description: Commit uncommitted work as a series of clean, logically-grouped Conventional Commits. Use whenever the user asks to "commit", "commit this", "commit my work/changes", "make commits", or wants a messy working tree split into sensible commits.
---

# Commit

Turn the current working tree into a series of small, logically-grouped commits that follow the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) spec. A single working tree usually holds several unrelated changes — split them into separate commits by theme, one concern per commit.

## Process

1. **Survey the changes.**
   - `git status` and `git diff --stat HEAD` for the overview.
   - For a small diff, read the diffs directly. For a **large or mixed** diff (many files, several unrelated features), spawn parallel `Explore` agents to investigate groups of files and report per-file summaries + proposed thematic groupings. Divide files across agents so they don't overlap. Tell each agent NOT to commit or modify anything.
   - Treat untracked files (`git status --porcelain | grep '^??'`) as part of the changeset — read new files directly rather than via `git diff`.

2. **Group into themes.** Each commit = one coherent concern (a feature, a fix, a refactor, a data regeneration, a doc update). Prefer **file-granular** commits — assign each file to exactly one commit. Only reach for hunk-level staging (`git add -p`) when a single file genuinely contains two unrelated concerns AND they can be cleanly separated; otherwise commit the whole file with the dominant theme and note any secondary aspect in the body.
   - Separate generated/bundled data from hand-written code.
   - Separate isolated fixes (e.g. a BLE tweak) from large UI work.
   - Order commits foundation → features (registries/infra/extracted components before the features that use them).

3. **Confirm the plan.** Before committing, show the user the proposed commit list (short type(scope): subject lines) so they can adjust. Skip this only if the user said to just do it.

4. **Commit.** Stage each group explicitly by path (`git add <files...>`) then `git commit`. Never `git add -A` blindly. Verify a clean tree at the end (`git status --porcelain` empty) and show `git log --oneline`.

5. **Push only if asked.** Don't push unless the user requests it. If on the default branch and the change warrants a branch, ask first.

## Message format

```
type(scope): short imperative subject

Optional body explaining what and why, wrapped ~72 cols.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

- **type**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `build`, `ci`, `revert`.
- **scope**: optional, lowercase, the area touched (e.g. `board`, `catalog`, `ble`, `home`, `navigation`, `data`, `scripts`). Derive scopes from the repo's own module/directory names.
- **subject**: imperative mood, lowercase start, no trailing period, ~50 chars.
- **body**: add when the change isn't self-evident from the subject — explain the *why*. Omit for trivial changes.
- **breaking changes**: append `!` after type/scope (`feat(api)!:`) and/or a `BREAKING CHANGE:` footer.
- Always end commit messages with the `Co-Authored-By` trailer above.

## Notes

- Match the user's intent, not a fixed commit count — "as many separate commits as you see fit" means split by concern, not artificially inflate.
- Each commit should ideally be coherent on its own; exact inter-commit compilation isn't required when the goal is organizing history.
- If the repo's existing history uses a different message style, still follow Conventional Commits (that's the point of this skill) unless the user says otherwise.
