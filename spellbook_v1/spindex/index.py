"""Persistent sidecar index with incremental sync.

On disk (spellbook_v1/data/):
    vectors.npz   ids: (N,) str, mat: (N, D) float32  — the embeddings
    manifest.json { id: {hash, importance, name, language, tags, contract, source} }

The manifest caches everything `find` needs so a query never touches the model for the
corpus side: the vector, the entry's importance (a 3B attention pass, computed once), and the
display fields. Only the query itself hits the model at find time.

Sync is diff-based: it re-embeds ONLY entries that are new or whose content hash changed, drops
entries deleted from the library, and keeps unchanged vectors untouched. That is the "recheck
the library later and adjust" behaviour — cheap to run repeatedly.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np

from .library import Entry


@dataclass
class SyncReport:
    added: list[str] = field(default_factory=list)
    changed: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)
    kept: int = 0

    def touched(self) -> int:
        return len(self.added) + len(self.changed)

    def __str__(self) -> str:
        return (f"+{len(self.added)} new  ~{len(self.changed)} changed  "
                f"-{len(self.removed)} removed  ={self.kept} unchanged")


# compute(entries) -> list of (vector, importance) aligned to the input order.
ComputeFn = Callable[[list[Entry]], list[tuple[np.ndarray, float]]]


class SidecarIndex:
    def __init__(self, vectors_path: Path, manifest_path: Path):
        self.vectors_path = vectors_path
        self.manifest_path = manifest_path
        self.manifest: dict[str, dict] = {}
        self._vecs: dict[str, np.ndarray] = {}   # id -> vector

    # ---- persistence ----
    @classmethod
    def load(cls, vectors_path: Path, manifest_path: Path) -> "SidecarIndex":
        idx = cls(vectors_path, manifest_path)
        if manifest_path.exists():
            idx.manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if vectors_path.exists():
            npz = np.load(vectors_path, allow_pickle=True)
            ids = list(npz["ids"])
            mat = npz["mat"]
            idx._vecs = {str(i): mat[k] for k, i in enumerate(ids)}
        return idx

    def save(self) -> None:
        self.vectors_path.parent.mkdir(parents=True, exist_ok=True)
        ids = list(self.manifest.keys())
        if ids:
            mat = np.stack([self._vecs[i] for i in ids]).astype(np.float32)
        else:
            mat = np.zeros((0, 0), dtype=np.float32)
        np.savez(self.vectors_path, ids=np.array(ids, dtype=object), mat=mat)
        self.manifest_path.write_text(
            json.dumps(self.manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # ---- diff-based sync ----
    def sync(self, entries: list[Entry], compute: ComputeFn) -> SyncReport:
        cur = {e.id: e for e in entries}
        rep = SyncReport()

        old_ids = set(self.manifest)
        new_ids = set(cur)
        rep.removed = sorted(old_ids - new_ids)
        added = new_ids - old_ids
        changed = {i for i in (new_ids & old_ids)
                   if self.manifest[i].get("hash") != cur[i].content_hash()}
        rep.added = sorted(added)
        rep.changed = sorted(changed)
        rep.kept = len(new_ids) - len(added) - len(changed)

        # drop deleted entries
        for i in rep.removed:
            self.manifest.pop(i, None)
            self._vecs.pop(i, None)

        # (re)compute only the delta
        todo = [cur[i] for i in sorted(added | changed)]
        if todo:
            results = compute(todo)
            for e, (vec, imp) in zip(todo, results):
                self._vecs[e.id] = np.asarray(vec, dtype=np.float32)
                self.manifest[e.id] = {
                    "hash": e.content_hash(),
                    "importance": float(imp),
                    "name": e.name,
                    "language": e.language,
                    "tags": e.tags,
                    "contract": e.contract,
                    "source": e.source,
                }
        return rep

    # ---- single-entry ops (lifecycle hooks: one new/edited/deleted spell at a time) ----
    def upsert(self, entry: Entry, compute: ComputeFn) -> str:
        """Embed one new-or-changed entry and store it. No-op (returns 'kept') when its content
        hash is unchanged, so re-firing the hook is safe. Caller saves."""
        prior = self.manifest.get(entry.id)
        if prior and prior.get("hash") == entry.content_hash():
            return "kept"
        (vec, imp), = compute([entry])
        self._vecs[entry.id] = np.asarray(vec, dtype=np.float32)
        self.manifest[entry.id] = {
            "hash": entry.content_hash(), "importance": float(imp),
            "name": entry.name, "language": entry.language, "tags": entry.tags,
            "contract": entry.contract, "source": entry.source,
        }
        return "added" if prior is None else "changed"

    def drop(self, entry_id: str) -> bool:
        """Remove one deleted entry. Returns True if it was present. Caller saves."""
        existed = entry_id in self.manifest
        self.manifest.pop(entry_id, None)
        self._vecs.pop(entry_id, None)
        return existed

    # ---- read side ----
    def is_empty(self) -> bool:
        return not self.manifest

    def ids(self) -> list[str]:
        return list(self.manifest.keys())

    def matrix(self) -> tuple[list[str], np.ndarray]:
        ids = self.ids()
        mat = np.stack([self._vecs[i] for i in ids]) if ids else np.zeros((0, 0))
        return ids, mat

    def meta(self, entry_id: str) -> dict:
        return self.manifest[entry_id]
