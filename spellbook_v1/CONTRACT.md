# Sidecar Contract — Spell Book ⇄ Elephant (v1 draft)

The boundary between Spell Book (the consumer, owns the UI) and the Elephant retrieval
engine (the infrastructure). As long as **neither side breaks its half of this contract**, any
future update on either side is compatible — no re-integration, no re-battery. A conformance
test (below) enforces it in CI on both repos so a break goes red *before* ship, not at runtime.

The shape is a **stateless request/response**. Spell Book initiates; the request carries the
current library path (the library can move); Elephant returns exactly what it found. Nothing
else is involved — no shared state, no callbacks, no Elephant reaching back into Spell Book.

```
Spell Book  ──find(problem, library_path)──▶  Elephant
Spell Book  ◀────────  set of matches  ──────  Elephant
```

---

## The two sides

### Down-contract (what Spell Book owes Elephant)
The library at `library_path` is **read-only** to Elephant and MUST expose:

- `index.json` — an array of entries, each with at least:
  - `id` (string, stable) · `name` (string) · `language` (string)
  - `tags` (string[]) · `contract` (string, may be empty) · a pointer into `sources/`
- `sources/` — the entry bodies referenced by `index.json`.

Elephant never writes to `library_path`. Its own index lives on Elephant's side, keyed by the
path (see Ownership). Adding fields to an entry is safe; renaming or removing the fields above
breaks the down-contract.

### Up-contract (what Elephant owes Spell Book)
A stable engine surface, funnelled through the sidecar's single model touch-point (`engine.py`
`_backend()`). The methods the sidecar depends on:

- `get_backend(...)` → a backend with `.embed(texts)`, `.importance(text)`, `.generate(...)`
- `RunConfig(...)` — construction stays valid when **new fields are added with safe defaults**
  (proven by the Category-9 merge: `sim_floor=0.0`, `sim_ceiling=None` were additive; 0/30 needs moved)
- `build_query(backend, problem, cfg)`
- `MemoryStore(cfg)` with `.add(mid, text, t, vec, importance)` and `.rank(qvec, now)`

Additive change is safe. Changing a signature or the meaning of a returned field breaks the
up-contract.

---

## The two model profiles (the "tiny vs 3B" button)

Elephant is **not** bundled with Spell Book. The install wizard offers a toggle; turning it on
downloads the sidecar + one of two interchangeable model profiles. Spell Book stores the choice
and passes nothing per-call — the profile is set once.

| Profile | Downloads | Entry embedding | Search path | Cost |
|---|---|---|---|---|
| **tiny** | MiniLM (~90MB) | MiniLM | embeds the raw problem (`prompt_text`) | CPU-fine, no GPU |
| **quality** | MiniLM + Qwen-3B | MiniLM | 3B rewords the problem first (`abstract_hyde`) | 3B, GPU-friendly |

**Invariant that makes them interchangeable:** entry embeddings are identical across profiles
(both MiniLM, same pooling). The 3B only ever touches the *query*, never the corpus — so an index
built under one profile is valid under the other, and the button changes search quality, not the
stored vectors. Per-entry cost is always just the tiny embedder; the 3B fires only on a search.

Selected via `SPINDEX_MODEL_PROFILE=tiny|quality` (default `quality`).

## The two calls

Spell Book only ever *needs* `find`. `sync` is an optional warm-up.

### `find(problem, library_path) -> Match[]`
Lazy-sync-then-find. Elephant:
1. locates its cached index for `library_path`;
2. if missing, or the library changed (content hash), rebuilds **only the delta** (diff-based);
3. embeds the query and ranks; returns the candidate set, best-first.

Returns the **candidate set**, not a single answer — the wide-net thesis: the agent/UI decides
which to act on. Empty array is a valid answer (nothing close enough). **Spell Book does not pass
a set size** — it asks for "matches"; the engine decides how many. (A future Elephant-side
`spread` dial will govern that count — see the model-profile note below.)

```jsonc
// Match
{
  "id":       "…",        // entry id from index.json — open it via the library
  "name":     "…",
  "language": "…",
  "score":    0.0,        // ranking score, best-first; NOT calibrated across libraries
  "contract": "…"         // entry contract text, for the UI to show
}
```

Cost: only the *first* `find` after a library change is slow (delta embed + model load).
Every subsequent `find` is milliseconds.

### `sync(library_path) -> {added, updated, removed, total}`
Build/refresh the index for `library_path` without querying. Spell Book calls this when it
*knows* it just changed the library, to warm the index so the next `find` is fast. Idempotent;
a no-op when nothing changed.

---

## Lifecycle wiring (what the install toggle connects)

The toggle sets a Spell-Book-internal config so its own events call the sidecar. The whole
surface is `spindex/api.py` — four calls, each taking the current `library_path`:

| Spell Book event | Sidecar call | Model work |
|---|---|---|
| new / edited spell | `add_entry(entry_id, library_path)` | one MiniLM embed (idempotent) |
| deleted spell | `remove_entry(entry_id, library_path)` | none |
| user searches (UI or `elephant search` CLI) | `find(problem, library_path)` | one query embed (+3B reword in quality) |
| after a bulk import | `sync(library_path)` | embeds only the delta |

`find` skips Spell Book's keyword matcher entirely and hits the sidecar directly. Sending
`(library_path, entry_id)` — not the entry body — keeps Elephant read-only and ignorant of the
vector format's placement.

## Ownership & invariants

- **Read-only:** Elephant never mutates `library_path`. The sidecar index (`vectors.npz` +
  manifest) is stored on Elephant's side, keyed by the path.
- **Path is authoritative per request:** the library can move; each request carries the current
  path. A new path is simply a new index key.
- **Stateless:** no state shared between calls beyond the on-disk index cache, which is derived
  entirely from the library and can be rebuilt at any time.
- **Set over rank-1:** success is the correct spell appearing *anywhere* in the returned set,
  not at position 1.

---

## Conformance test (the guardrail)

Two small suites, each pinned to one side, run in CI on both repos:

- **Down-contract test** (lives with Spell Book): validate a fixture `index.json` against the
  schema above — entries carry `id/name/language/tags/contract` + a `sources/` pointer.
- **Up-contract test** (lives with Elephant / the sidecar): assert the engine surface exists and
  a fixture `find` over a tiny fixture library returns a non-empty, well-formed `Match[]`.

A change on either side that violates its half fails its suite before merge. That *is* the
compatibility monitor — failure at the source, not a runtime watcher.

---

## Out of scope for v1
- Write-back into Spell Book (Elephant suggesting new spells / edits).
- The abstain gate (`sim_floor`/`gating.py`) — present in the engine but not wired; opting it in
  is a scoring change, tracked separately, and does not alter this contract.
- Packaging Elephant as an installable dependency (the v2 delivery goal); v1 ships vendored with
  this contract as the guardrail.
