# Elephant sidecar for Spell Book — v1 (`spindex`)

A standalone, **read-only** companion to the Spell Book code library. It reads the library,
builds its **own** vector index, and answers *"which spell for this problem?"* with the Elephant
ambient-retrieval engine instead of Spell Book's keyword `sb search`. It never writes to the
library (no `sb add`, no edits) — that's phase 2.

**This folder is the whole handoff.** The boundary spec is [`CONTRACT.md`](CONTRACT.md); the API
Spell Book calls is [`spindex/api.py`](spindex/api.py). Start with those two.

---

## What Spell Book calls (`spindex/api.py`)

Four functions, each takes the current `library_path` (the library can move). Stateless:

```python
from spindex import api

api.add_entry(entry_id, library_path)      # new/edited spell -> embed just it (idempotent)
api.remove_entry(entry_id, library_path)   # deleted spell    -> drop it
matches = api.find(problem, library_path)  # search -> candidate SET, best-first
api.sync(library_path)                     # optional: bulk warm-up after an import
```

`find` returns a list of `{id, name, language, score, contract}` — the **set**, not one answer
(a smart caller picks which to act on). Empty list = nothing close enough. Spell Book does **not**
pass a set size; the engine decides. See [`CONTRACT.md`](CONTRACT.md) for the full boundary and
the lifecycle-wiring table.

## The model button (tiny vs 3B)

Elephant is not bundled with Spell Book — the install toggle downloads it plus one profile:

| `SPINDEX_MODEL_PROFILE` | downloads | search path | needs a GPU? |
|---|---|---|---|
| `tiny` | MiniLM (~90MB) | embeds the raw problem | no |
| `quality` *(default)* | MiniLM + Qwen-3B | 3B rewords the problem first | GPU-friendly, not required |

**Entry embeddings are identical across profiles** (both MiniLM) — the 3B only touches the query,
never the corpus, so the index is profile-independent and per-entry cost is always just the tiny
embedder. `quality` is the validated default (see Status); `tiny` is a real no-GPU option that
trades differently (stronger on concrete-noun needs, weaker where rewording helps).

## Where the engine lives (`ELEPHANT_HOME`)

The sidecar imports the `ambient` engine package. Point `$ELEPHANT_HOME` at the directory that
**contains** `ambient/` (what the install toggle drops). On a dev checkout it defaults to
`<repo>/prototype`, so nothing is needed there. This is the only path that assumes a layout.

## CLI (dev / demo)

```bash
python -m spindex status              # library + index state, staleness, active profile
python -m spindex sync                # incremental re-index
python -m spindex find "<problem>"    # ambient retrieval
python -m spindex ab   "<problem>"    # sb keyword vs ambient, side by side (the lift demo)
```

Under the shared CUDA venv, use the wrappers `spindex.sh` / `spindex.cmd` (they resolve the
interpreter; override with `$SPINDEX_PYTHON`).

## How it works

- **Heavy at write, light at read.** Embedding happens once per entry, at `add_entry`/`sync`, and
  is cached (`data/vectors.npz` + `data/manifest.json`). A search only embeds the query and does
  cosine ranking; the corpus side never re-touches the model.
- **What gets embedded:** `name + contract + scars + tags + inputs/outputs + notes` — the semantic
  surface, not the full source (long, dilutes the vector). `contract`/`scars` carry the
  logical/causal content keyword search misses. Source stays a display pointer.
- **Incremental:** change detection keys on a content hash of the composed text, so re-indexing
  after edits re-embeds only what changed and prunes deleted ids. Hooks are idempotent.
- **Ranking is proximity only.** It reuses the research `MemoryStore`, but **importance is OFF**
  and recency/frequency are neutral on a static corpus (every entry t=0), so ranking reduces to
  cosine. (Importance is a *conversational* salience signal; on a static code library it's
  near-flat with a few outliers that only inject noise — the battery showed this, so it's off.)

## Status (validated)

On the real 268-entry library, a 30-need battery (problem-level phrasing, blind), judged against
the library, with a `sb search` keyword control per need:

- **quality profile:** got the correct spell into the returned set for **16/20** in-domain needs;
  the keyword control got **8/20**. Head-to-head, the tool caught 10 the keyword search missed;
  it lost 2 the keyword search caught. Out-of-domain needs return nothing usable.
- **tiny profile:** retains quality's top pick on 13/20 (proxy); recovers some concrete-noun needs
  quality over-abstracts (e.g. character-controller). A full hand-judged tiny recall is a follow-up.

Known gap: clean **abstain** on out-of-domain is not solved — a couple of semantic bleeds
(OAuth, transcode) score in the same band as weak real matches. The engine now ships a similarity
floor gate (`sim_floor` / `gating.py`) for exactly this, but it's not wired into the ranking path
yet; opting it in is a scoring change tracked separately.

## Layout

```
spellbook_v1/
  CONTRACT.md      the Spell Book <-> Elephant boundary (read this first)
  spindex/
    api.py         the public surface: find / add_entry / remove_entry / sync / status
    config.py      paths, ELEPHANT_HOME, model profile, library discovery
    library.py     read index.json (read-only) -> Entry; compose() + content_hash()
    index.py       SidecarIndex: persist, diff-based sync, single-entry upsert/drop
    engine.py      the model touch-point: backend (tiny/quality) + query build + ranking
    cli.py         status / sync / find / ab
  tests/           sync test + the 30-need battery and results
  data/            generated index (git-ignored, regenerable)
```

## Phase 2 (not built)

Write-back into Spell Book — Elephant suggesting new spells / field refinements. Deferred by
design; needs Spell Book's OK on how refined fields attach.
