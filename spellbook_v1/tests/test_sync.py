"""Incremental-sync correctness — the load-bearing feature: re-checking the library must
recognize new / changed / deleted entries and adjust, re-embedding only the delta.

Model-free: a fake compute_fn returns a deterministic vector + importance and RECORDS which
ids it was asked to (re)compute, so we can assert unchanged entries are never re-embedded.
Run: ../prototype/.venv-cuda/Scripts/python.exe -m pytest tests/  (or just run this file).
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from spindex.index import SidecarIndex          # noqa: E402
from spindex.library import Entry               # noqa: E402


def _entry(eid, contract):
    return Entry(id=eid, name=eid, language="python", tags=["t"], contract=contract,
                 inputs="", outputs="", scars="", notes="", source=f"sources/{eid}.py")


def _index(tmp):
    return SidecarIndex.load(tmp / "vectors.npz", tmp / "manifest.json")


def run(tmp: Path):
    computed_calls = []

    def compute(entries):
        computed_calls.append([e.id for e in entries])
        return [(np.ones(4, dtype=np.float32) * (i + 1), 0.5) for i, _ in enumerate(entries)]

    # initial: 3 new
    idx = _index(tmp)
    rep = idx.sync([_entry("a", "does A"), _entry("b", "does B"), _entry("c", "does C")], compute)
    idx.save()
    assert rep.added == ["a", "b", "c"] and rep.changed == [] and rep.removed == [], rep
    assert computed_calls[-1] == ["a", "b", "c"]

    # reload from disk, no changes -> nothing recomputed
    idx = _index(tmp)
    assert len(idx.manifest) == 3 and set(idx._vecs) == {"a", "b", "c"}
    rep = idx.sync([_entry("a", "does A"), _entry("b", "does B"), _entry("c", "does C")], compute)
    assert rep.touched() == 0 and rep.kept == 3, rep
    assert len(computed_calls) == 1, "unchanged entries must not be re-embedded"

    # mutate: change b's contract, delete c, add d
    idx = _index(tmp)
    rep = idx.sync([_entry("a", "does A"), _entry("b", "does B DIFFERENTLY"), _entry("d", "does D")],
                   compute)
    idx.save()
    assert rep.added == ["d"] and rep.changed == ["b"] and rep.removed == ["c"], rep
    assert computed_calls[-1] == ["b", "d"], "only changed+new recomputed"

    # final state reflects the adjustment
    idx = _index(tmp)
    assert set(idx.manifest) == {"a", "b", "d"}
    assert set(idx._vecs) == {"a", "b", "d"}
    assert idx.manifest["b"]["contract"] == "does B DIFFERENTLY"
    print("OK: added/changed/removed/kept all correct; only the delta was re-embedded.")


def test_sync(tmp_path):        # pytest entry
    run(tmp_path)


if __name__ == "__main__":      # plain-python entry
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        run(Path(d))
