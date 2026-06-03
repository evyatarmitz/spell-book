# Spell Book

A local-first personal code library — drop a source file, scavenge its functions, annotate them, and catalog them forever. Works offline. Your data stays on your machine.

## Prerequisites

- **[Node.js](https://nodejs.org/) v18 or newer** — download the LTS version from nodejs.org. npm comes bundled with it, no separate install needed.
- A modern browser (Chrome, Firefox, Edge)
- That's it — no database, no Docker, no cloud account.

## Quick start

**Windows — easiest way:**
1. Clone or download this repo
2. Open a terminal in the folder and run `npm install`
3. Double-click **`start.bat`** — it starts the server and opens the browser automatically

**Any OS:**
```sh
npm install
npm start
```
Then open **http://localhost:3333** in your browser.

> **First run:** the `library/` folder is created automatically. Nothing to set up.

## What it is

A catalog + web UI for storing, browsing, tagging, and exporting reusable code units — functions, small systems, math helpers, etc. extracted from past projects so you can paste them into future ones without rewriting.

Each entry is one function or self-contained system. Code stored here is meant to be pure or near-pure: data in, data out. It does not wire entries together; it just stores them.

## File layout

```
spell-book/
├── server.js           # Local web server + REST API
├── package.json
├── README.md
├── start.bat           # Windows: double-click to launch
├── public/             # Web UI (served as static files)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── logo.png        # Brand logo
└── library/            # Your library — created on first run, gitignored
    ├── index.json      # Catalog: one JSON object per entry
    └── sources/        # Source files, one per entry
```

## Backup and version control

The entire library is in the `library/` folder. To back it up:

- **Copy the folder** — zip it, put it on a drive, done.
- **Commit to git** — `library/index.json` is pretty-printed with stable key ordering, so diffs are clean. Add `library/` to your repo and commit whenever you add or edit entries.

## Adding entries

**Via UI:** Click **+ New Entry**, fill in the form, paste your source code, save.

**Manually:** Add a source file to `library/sources/your-id.ext`, then add an entry to `library/index.json` matching the schema below. The server reads from disk on every request, so changes take effect immediately on page refresh.

## Catalog schema

Each entry in `library/index.json`:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, e.g. `resolve-aabb-js`. Becomes the source filename. |
| `name` | string | Display name, e.g. `resolveAabb`. |
| `language` | string | `javascript`, `python`, `rust`, etc. |
| `tags` | string[] | Free-form. Domain tags (`collision`, `2d`) and meta tags (`pure`, `stateful`). |
| `origin` | string | Project it came from, e.g. `P1`. |
| `touched` | string[] | Projects that later modified it, e.g. `["P1", "P4"]`. |
| `status` | string | `stable` / `scarred` / `experimental`. |
| `contract` | string | What the function does. |
| `inputs` | string | Argument description. |
| `outputs` | string | Return value description. |
| `scars` | string | Known issues, gotchas, things to watch out for. |
| `notes` | string | Free-form personal notes. |
| `source` | string | Relative path to the source file, e.g. `sources/resolve-aabb-js.js`. |
| `created_at` | ISO string | Auto-managed. |
| `updated_at` | ISO string | Auto-managed. |

## Export

Select entries using the checkboxes, then click **Export ZIP**. The zip contains one concatenated source file per language, with header comments showing name, origin, contract, etc. Drop the file into a new project — no further processing needed.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Esc` | Close detail panel / modal |
| `Ctrl+Enter` | Save modal |

## API

The server exposes a small REST API if you want to script against it:

```
GET    /api/entries          List all entries (no source content)
GET    /api/entries/:id      One entry with source content
POST   /api/entries          Create entry
PUT    /api/entries/:id      Update fields (partial update)
DELETE /api/entries/:id      Delete entry and source file
POST   /api/export           Body: { ids: [...] } → zip download
```
