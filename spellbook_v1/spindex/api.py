"""Public API — the ONLY surface Spell Book calls. Everything here matches CONTRACT.md.

Stateless request/response. Spell Book initiates; every call carries the current library path
(the library can move); Elephant reads it READ-ONLY and returns what it found. The sidecar's
vector index lives on Elephant's side (config.DATA_DIR), keyed to that library — never written
into the library.

Lifecycle (wired to Spell Book's events by the install toggle):
    new / edited spell  ->  add_entry(entry_id, library_path)
    deleted spell       ->  remove_entry(entry_id, library_path)
    user searches       ->  find(problem, library_path)
    (optional warm-up)  ->  sync(library_path)     # after a bulk import, before first search

The heavy model import (torch) is deferred into each call so importing this module is cheap.
"""
from __future__ import annotations

from pathlib import Path

from . import config
from .index import SidecarIndex
from .library import Entry, load_entries


def _open(library_path: str | None):
    lib = config.resolve_lib(library_path)
    idx = SidecarIndex.load(config.VECTORS_PATH, config.MANIFEST_PATH)
    return lib, idx


def _entry_by_id(lib: Path, entry_id: str) -> Entry | None:
    # index.json is metadata (no source bodies), so a full parse to pick one entry is cheap.
    for e in load_entries(lib):
        if e.id == entry_id:
            return e
    return None


# ---- request: search --------------------------------------------------------------------------
def find(problem: str, library_path: str | None = None, top_k: int | None = None,
         query_mode: str | None = None) -> list[dict]:
    """Return the candidate SET (best-first), not a single answer — a smart caller picks which to
    act on. Each match: {id, name, language, score, contract}. Empty list = nothing close enough.

    top_k / query_mode default from the active model profile; callers normally pass neither.
    """
    from . import engine  # heavy (torch) — deferred to call time
    lib, idx = _open(library_path)
    if idx.is_empty():
        return []
    k = top_k or config.DEFAULT_TOP_K
    mode = query_mode or config.DEFAULT_QUERY_MODE
    hits = engine.rank(idx, problem, mode, top_k=k)
    out = []
    for eid, score, _sim, _imp in hits:
        m = idx.meta(eid)
        out.append({"id": eid, "name": m.get("name", eid), "language": m.get("language", ""),
                    "score": round(float(score), 4), "contract": m.get("contract", "")})
    return out


# ---- lifecycle: one entry at a time -----------------------------------------------------------
def add_entry(entry_id: str, library_path: str | None = None) -> str:
    """New or edited spell -> (re)embed just this entry. Returns 'added' | 'changed' | 'kept'.
    Idempotent: unchanged content is a no-op, so firing the hook twice is safe."""
    from . import engine
    lib, idx = _open(library_path)
    entry = _entry_by_id(lib, entry_id)
    if entry is None:
        raise KeyError(f"entry {entry_id!r} not found in {lib}")
    status = idx.upsert(entry, engine.compute_fn)
    if status != "kept":
        idx.save()
    return status


def remove_entry(entry_id: str, library_path: str | None = None) -> bool:
    """Deleted spell -> drop it from the index. Returns True if it was present. No model needed."""
    _lib, idx = _open(library_path)
    if idx.drop(entry_id):
        idx.save()
        return True
    return False


# ---- optional: bulk warm-up -------------------------------------------------------------------
def sync(library_path: str | None = None) -> dict:
    """Re-index the whole library in one pass (diff-based: only new/changed entries hit the model,
    deleted ids are dropped). Call after a bulk import so the first search is fast. Idempotent."""
    from . import engine
    lib, idx = _open(library_path)
    rep = idx.sync(load_entries(lib), engine.compute_fn)
    idx.save()
    return {"added": rep.added, "changed": rep.changed, "removed": rep.removed, "kept": rep.kept}


def status(library_path: str | None = None) -> dict:
    """Cheap (no model): library size, indexed count, and staleness vs the library."""
    lib, idx = _open(library_path)
    cur = {e.id: e for e in load_entries(lib)}
    old, new = set(idx.manifest), set(cur)
    changed = sum(1 for i in (new & old)
                  if idx.manifest[i].get("hash") != cur[i].content_hash())
    return {"library": str(lib), "entries": len(cur), "indexed": len(idx.manifest),
            "profile": config.MODEL_PROFILE,
            "stale": {"new": len(new - old), "changed": changed, "removed": len(old - new)}}


__all__ = ["find", "add_entry", "remove_entry", "sync", "status"]
