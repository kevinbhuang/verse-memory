# Verse Memory

A personal Scripture-memory workspace for a fixed collection of **171 passages**
(*100 Verses Every Christian Should Know — 171-Passage Collection*).

It is a local-first, installable web application: browse the collection, tick off
what you have memorized, practise with six review modes, and let a transparent
spaced-repetition ladder decide what comes back and when. There is no account and
no server — everything lives in IndexedDB on your device, and you can export or
restore it as JSON at any time.

---

## Contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Setup](#setup)
- [Everyday commands](#everyday-commands)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [The passage data file](#the-passage-data-file)
- [How text validation works](#how-text-validation-works)
- [How scheduling works](#how-scheduling-works)
- [Difficulty and weak words](#difficulty-and-weak-words)
- [Backing up your progress](#backing-up-your-progress)
- [Offline and installation](#offline-and-installation)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Testing](#testing)
- [Deploying to Netlify](#deploying-to-netlify)
- [Adding cloud sync later](#adding-cloud-sync-later)
- [ESV attribution and API notes](#esv-attribution-and-api-notes)
- [Deferred enhancements](#deferred-enhancements)

---

## What it does

| Route | Purpose |
| --- | --- |
| `/` | Dashboard: memorized count, due, overdue, difficult, streak, section bars, seven-day forecast, recent activity |
| `/verses` | The complete library, grouped by the seven sections in canonical order, with search, filters, sorting and bulk actions |
| `/verses/:verseId` | One passage: text, notes, review history, weak words, schedule, per-passage overrides |
| `/review` | Session builder: pick a source, a size and a mode strategy |
| `/review/session` | The running session; pausable and resumable |
| `/progress` | Statistics: section progress, activity calendar, accuracy trend, review load, hardest passages, most-missed words |
| `/settings` | Preferences, data integrity report, export/import, resets |

Review modes: **flashcard**, **first-letter typing**, **progressive word-hiding**,
**full typing**, **reference practice** (both directions) and **spoken recitation**
(Web Speech API, clearly labelled as approximate and never required).

---

## Requirements

- **Node 20.19+** (22 LTS recommended; Netlify builds on 22)
- npm 10+
- A Chromium-based browser for the Playwright suite (installed by Playwright)

Check your version:

```bash
node --version
```

---

## Setup

```bash
git clone <your-repo-url>
cd verse-memory
npm install
cp .env.example .env      # optional; every value has a sensible default
npm run dev               # http://localhost:5173
```

The first run validates the passage file, so a corrupted or edited
`src/data/verses.json` is caught immediately rather than silently shipped.

---

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Validates passages, type-checks, then builds to `dist/` |
| `npm run preview` | Serves the production build on port 4173 |
| `npm run lint` | ESLint across the project |
| `npm run typecheck` | TypeScript in strict mode, no emit |
| `npm run test` | Vitest unit and component suites |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end suite (builds and previews automatically) |
| `npm run validate:verses` | Structural and hash validation of the 171 passages |
| `npm run validate:verses:report` | The same, plus a per-section report |
| `npm run hash:verses` | Re-baselines content hashes after an *intentional* text change |
| `npm run verify:esv` | Optional developer-only check against the ESV API |
| `npm run icons` | Regenerates the PWA icons in `public/icons/` |
| `npm run clean:js` | Removes accidental `tsc` emit beside TypeScript sources |

---

## Environment variables

Copy `.env.example` to `.env`. Nothing here is required to run or review.

| Variable | Exposed to browser | Purpose |
| --- | --- | --- |
| `VITE_APP_NAME` | yes | Application name in the header and manifest |
| `VITE_COLLECTION_TITLE` | yes | Collection title, e.g. *100 Verses Every Christian Should Know* |
| `VITE_COLLECTION_SUBTITLE` | yes | Subtitle, e.g. *171-Passage Collection* |
| `VITE_TRANSLATION_ATTRIBUTION` | yes | Footer and About attribution text |
| `ESV_API_TOKEN` | **no** | Local `verify:esv`, Vite audio proxy, and Netlify `esv-audio` function |

`ESV_API_TOKEN` is deliberately **not** prefixed with `VITE_`, so Vite cannot
inline it into a client bundle. `.env` is git-ignored; never commit a real token.
For production Listen audio, set `ESV_API_TOKEN` in the Netlify site environment
variables (same name as local `.env`).

The collection title is read once in `src/config/app.ts` and used from there, so
renaming the collection is a one-line change rather than a search-and-replace.

---

## Project structure

```
src/
  components/          Layout, UI primitives, Scripture renderer, badges, dialogs
    layout/            AppLayout, Footer, PageHeader, UpdatePrompt
    ui/                Button, Card, Badge, Field, Dialog, Toast, StatTile, …
  config/app.ts        Configurable names, attribution, section boundaries
  data/                verses.json (canonical) + loader, Zod schema, integrity report
  db/                  Dexie schema, migrations, default records
  features/
    library/           Filters, verse rows, bulk action bar
    review/            Session runner, rating panel, summary, modes/
    settings/          Data management (export, import, resets)
    verse/             "Why this is difficult" and weak-word panels
  hooks/               useSettings, useProgressData (live queries), useHotkeys
  lib/                 Pure logic: scheduler, difficulty, weakWords, hash, text/
    text/              tokenize, normalize, diff, reference matching
  pages/               One component per route
  repositories/        Persistence interfaces + the Dexie implementation
  services/            progress, review, session, stats, backup
  test/                Render helpers, database helpers, Vitest setup
  types/               Shared domain types
e2e/                   Playwright specs
scripts/               validate-verses.mjs, verify-esv.mjs, generate-icons.mjs
```

The rule of thumb: `lib/` is pure and easily testable, `services/` coordinates
`lib/` with `repositories/`, and components do presentation and interaction.
No component imports Dexie directly.

---

## The passage data file

`src/data/verses.json` is the single source of truth. Each record:

```json
{
  "id": "verse-001",
  "order": 1,
  "reference": "Exodus 19:4-6",
  "text": "…",
  "translation": "ESV",
  "section": "Law and History",
  "verified": false,
  "verificationDate": null,
  "contentHash": "9f4390f8…"
}
```

Section boundaries are fixed and enforced:

| # | Section | Passages |
| --- | --- | --- |
| 1 | Law and History | 1–7 |
| 2 | Wisdom and Poetry | 8–19 |
| 3 | Prophets | 20–37 |
| 4 | Gospels | 38–68 |
| 5 | Acts | 69–72 |
| 6 | Paul’s Epistles | 73–144 |
| 7 | General Epistles and Revelation | 145–171 |

### Importing or replacing the passages

The collection already ships in the repository. To replace it:

1. Edit `src/data/verses.json`, keeping the array in canonical order 1–171.
2. Run `npm run validate:verses`. It will fail and tell you exactly what is wrong.
3. If the text changed **on purpose**, run `npm run hash:verses` to re-baseline
   the content hashes, and commit the diff so the change is visible in review.

Progress records reference a verse `id` only. They never copy Scripture text, so
re-baselining the file does not disturb your history.

---

## How text validation works

Three layers, all of which must agree:

1. **Build-time script** — `npm run validate:verses` (part of `npm run build`)
   fails on: a count other than 171; non-consecutive or duplicated `order`;
   duplicated or misnamed ids; a missing reference, text, section or translation;
   a translation other than `ESV`; a section that contradicts the boundary table;
   or a `contentHash` that does not match its text. Use `--report` for a
   per-section breakdown and the list of any changed Scripture strings.
2. **Runtime Zod schema** — `src/data/verses.ts` parses the JSON on load, so a
   malformed record cannot reach the UI.
3. **In-app integrity report** — Settings → *Scripture data integrity* recomputes
   every hash in the browser and reports count, order, id uniqueness, verified
   count and any mismatch. It is read-only; the app never rewrites a passage.

The hash is SHA-256 over the NFC-normalized text (`src/lib/hash.ts`, matched
against Node's `crypto` in unit tests).

**Canonical text is never mutated for grading.** Normalization produces a
separate comparison string; what you read on screen is always the file's text.

---

## How scheduling works

`src/lib/scheduler.ts` is the only place scheduling decisions are made. It is a
plain, predictable ladder — **not** FSRS, and it does not pretend to be:

```
1 → 3 → 7 → 14 → 30 → 60 → 120 → 180 → 365 days
```

| Rating | Effect |
| --- | --- |
| **Again** | Failed recall: back to 1 day, consecutive successes reset, lapse count +1, difficulty up, eligible to reappear later in the session |
| **Hard** | Held at the current rung, difficulty up slightly |
| **Good** | Up one rung, consecutive successes +1 |
| **Easy** | Up two rungs, consecutive successes +1, difficulty down |

Caps are applied in order and the reason is surfaced in the UI:

1. **Pinned frequency** — daily, weekly, monthly, quarterly, twice-yearly, annual
2. **Per-passage maximum interval** — set on the verse detail page
3. **Global maximum interval** — Settings
4. **Difficult-passage interval** — a difficult passage is capped (7 days by
   default) until it earns **three consecutive** Good or Easy ratings

Other guarantees: a due date is never in the past; a manual override is clamped
to the start of today or later; every scheduling decision (previous interval,
next interval, next due date) is written to the review log; and the verse detail
page explains *why* a passage is being recommended.

Every rating button shows the interval it would produce before you press it.

---

## Difficulty and weak words

Difficulty is arithmetic and inspectable — no opaque scoring. `src/lib/difficulty.ts`
scores 0–100 from lapses, recent accuracy, hint and full-reveal usage, incorrect
keystrokes, response time, repeated errors on the same words, days overdue and any
manual flag. The **"Why this is difficult"** panel lists each contributing factor
and its points.

A **manual** difficult flag stays until you remove it. The automatic
**Needs Attention** status clears itself after sustained improvement.

Mistakes are recorded per word position (`src/lib/weakWords.ts`): misses, hints,
substitutions, last miss and success rate. That drives a deliberately subtle heat
map, biased word selection in progressive-hiding, and the "phrase to work on"
hint on the verse page.

---

## Backing up your progress

Settings → **Data**:

- **Export all data (JSON)** — schema version, export date, progress, review
  logs, sessions, settings and notes. It stores verse ids, references and content
  hashes rather than duplicating copyrighted Scripture text.
- **Progress CSV** and **Review history CSV** for spreadsheets.
- **Copy progress summary** for a plain-text overview (it downloads instead if
  the clipboard is unavailable).
- **Choose a backup file** — validated with Zod, then previewed before anything is
  written: records added, updated and rejected, version incompatibilities,
  unknown verse ids and content-hash mismatches. Choose **merge** (default) or
  **replace**. Nothing is overwritten without confirmation.
- **Resets** — everything, one section, or one passage, each behind a
  confirmation dialog.

Export before you clear browser data, and after any big memorization push.

---

## Offline and installation

`vite-plugin-pwa` (Workbox) precaches the shell, assets and passage data, so the
whole collection and every review mode work offline after the first load. Install
it from your browser's address bar or *Add to Home Screen*.

Updates use `registerType: 'prompt'`: a discreet banner appears when a new
version is ready, and your IndexedDB data survives the update. No secrets or API
tokens are ever cached.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` / `Enter` | Reveal |
| `1` `2` `3` `4` | Again, Hard, Good, Easy |
| `H` | Hint (`Shift`+`Enter` while typing) |
| `D` | Toggle the difficult flag |
| `N` | Open the note |
| `Escape` | Pause and leave the session (with confirmation) |

Shortcuts do not fire while you are typing in a field, apart from `Escape`.

---

## Testing

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

**Unit tests** cover the passage file (exactly 171 records, ids `verse-001`–
`verse-171`, unique consecutive order, section boundaries), hashing, tokenizing,
first-letter generation, apostrophes and quotation marks, normalization, full-text
grading, reference matching, the scheduler, difficulty scoring, weak-word
tracking, statistics, the export/import round trip and the Dexie migrations.

**Component tests** cover marking memorized, marking difficult, saving a note,
flashcard reveal, first-letter entry, rating a review, library filtering, session
setup, the session runner, and the dashboard, progress, settings and verse-detail
pages.

**Playwright tests** cover the four journeys that matter most: mark a passage
memorized and confirm it survives a reload; complete a first-letter review and
confirm the next due date is stored; export, reset, re-import and confirm
restoration; and offline behaviour after the service worker installs.

---

## Deploying to Netlify

`netlify.toml` is committed, so connecting the repository is enough:

- Build command `npm run build`, publish directory `dist`, Node 22
- SPA fallback so deep links work
- Immutable caching for hashed assets; `no-cache` for `index.html` and `sw.js`
  so updates are picked up promptly

Set any `VITE_*` overrides in Netlify's environment variables. Do **not** set
`ESV_API_TOKEN` there — verification is a local developer task and the runtime
never needs it.

---

## Adding cloud sync later

Persistence sits behind interfaces in `src/repositories/types.ts`
(`ProgressRepository`, `ReviewLogRepository`, `SessionRepository`,
`WordStatRepository`, `SettingsRepository`, `MetaRepository`, all bundled as
`DataStore`). `src/repositories/dexieStore.ts` is simply the IndexedDB
implementation, and `getDataStore()` is the single access point.

To add Supabase or similar:

1. Implement `DataStore` against your backend (for example
   `src/repositories/supabaseStore.ts`).
2. Call `setDataStore(createSupabaseStore())` during start-up, or wrap the Dexie
   store so writes go to both and reads stay local-first.
3. Use the existing `updatedAt` timestamps on progress records and the `meta`
   table for conflict resolution, and keep review logs append-only — they already
   carry stable ids.

No feature code, service or component imports Dexie directly, so nothing above
the repository layer needs to change.

---

## ESV attribution and API notes

The footer and Settings → About display the attribution from
`VITE_TRANSLATION_ATTRIBUTION`:

> Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard
> Version®), copyright © 2001 by Crossway, a publishing ministry of Good News
> Publishers. Used by permission. All rights reserved.

Optional verification is a **developer script**, never browser code:

```bash
echo "ESV_API_TOKEN=your-token" >> .env

npm run verify:esv                              # every unverified passage
node scripts/verify-esv.mjs --all --limit 20    # a batch of all passages
node scripts/verify-esv.mjs --only verse-004    # one passage, read-only
```

It reports word-level differences and exits non-zero rather than overwriting
anything. Adopting the API text is explicit and per-passage:

```bash
node scripts/verify-esv.mjs --only verse-004 --approve
npm run validate:verses
```

Matching passages get `verified: true` and a `verificationDate`. Requests are
spaced to stay within the published rate limit. The app never contacts the API at
runtime, so reviewing works with no token and no network.

---

## Deferred enhancements

Intentionally left out of this version:

- Cloud sync and multi-device accounts (the repository seam is ready)
- A real FSRS implementation — the ladder is honest about what it is
- Audio recording or playback of your own recitations; spoken recitation relies on
  the browser's Web Speech API, which is unavailable in some browsers and falls
  back gracefully
- Sharing, social features and leaderboards
- Print or PDF export of the collection

---

Scripture text is treated as immutable canonical content: it is validated,
hashed, and never rewritten by the application.
