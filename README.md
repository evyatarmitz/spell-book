# Spell Book

A local-first personal code library — drop a source file, scavenge its functions, annotate them, and catalog them forever. Works offline. Your data stays on your machine.

A native desktop app (Tauri/Rust) plus a CLI for scripting or AI agent use.

## Quick start

**Windows:**
1. Go to [Releases](https://github.com/evyatarmitz/spell-book/releases/latest)
2. Download the installer (`.exe`) and run it

That's the standard install flow — Windows will show an "Unknown publisher" warning since the binary isn't code-signed; this is normal for small open-source projects, not a sign of tampering. The `library/` folder is created automatically next to the installed app on first run.

**Building from source instead:**
```sh
# Requires Rust (https://rustup.rs)
cargo install tauri-cli --version "^2" --locked
cd src-tauri
cargo tauri build
```
The built app is at `src-tauri/target/release/spell-book.exe`, the CLI at `src-tauri/target/release/sb.exe`.

## What it is

A catalog + desktop UI for storing, browsing, tagging, and exporting reusable code units — functions, small systems, math helpers, etc. extracted from past projects so you can paste them into future ones without rewriting.

Each entry is one function or self-contained system. Code stored here is meant to be pure or near-pure: data in, data out. It does not wire entries together; it just stores them.

## File layout

```
spell-book/
├── src-tauri/           # Rust app — Tauri commands + CLI binary
│   ├── src/
│   │   ├── catalog.rs   # Shared catalog logic (used by both app and CLI)
│   │   ├── lib.rs       # Tauri commands
│   │   └── bin/sb.rs    # CLI entry point
│   └── tauri.conf.json
├── public/              # Desktop UI (HTML/CSS/JS, rendered by Tauri's webview)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── prism/           # Vendored syntax highlighter (offline)
├── tools/
│   └── make_icons.py    # Regenerates src-tauri/icons/ from public/logo.png
├── AI_README.md         # Onboarding doc for AI agents using the CLI
└── library/             # Your library — created on first run, gitignored
    ├── index.json       # Catalog: one JSON object per entry
    └── sources/         # Source files, one per entry
```

## Library location

Defaults to `library/` next to the app executable — no setup needed. To point it somewhere else, click **Change…** under LIBRARY in the sidebar, or use `sb use <path>` from the CLI. The override is stored in `~/.spellbook/config.json` and is shared between the app and the CLI.

## Backup and version control

The entire library is in the `library/` folder. To back it up:

- **Copy the folder** — zip it, put it on a drive, done.
- **Commit to git** — `library/index.json` is pretty-printed with stable key ordering, so diffs are clean.

## Adding entries

**Via UI:** Click **+ New Entry**, drop a source file (or paste code), fill in the metadata, save.

**Via CLI:**
```sh
sb add entry.json
```
See [`AI_README.md`](AI_README.md) for the JSON format — it's written for AI agents but works as a human reference too.

## CLI reference

```
sb use <path>         Point sb at your library folder (only needed to override the default)
sb status             Show library path and entry count

sb init-ai            Copy AI_README.md into the current folder
sb add <entry.json>   Add a new entry from a JSON file
sb search <query>     Search by name, language, tags, or contract
sb get <name|id>      Print source for an entry
sb update             Check for a new release and self-update
```

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

Select entries using the checkboxes, then click **Export ZIP**. You'll get a native save dialog. The zip contains one concatenated source file per language, with header comments showing name, origin, contract, etc. Drop the file into a new project — no further processing needed.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Esc` | Close detail panel / modal |
| `Ctrl+Enter` | Save modal |
