"""Battery v2 — recall-oriented, with a keyword control per need.

The system casts a WIDE net on purpose (return ~8 candidates); a smart agent then picks the one
to act on. So success is measured over the RETURNED SET, not rank-1:
    - did the correct spell appear anywhere in the 8?  (recall)
The final GOT-THE / GOT-A / MISS labels are a human judgement pass against the library, done after
this run. This script only produces the evidence: for each need it records the tool's top-8 (with
contracts, so the hits can be judged from the dump) and the control `sb search` on the obvious
keyword.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOL = HERE.parent.parent
sys.path.insert(0, str(TOOL))

from spindex import config, engine             # noqa: E402
from spindex.index import SidecarIndex         # noqa: E402

MODE = "abstract_hyde"
TOP_K = 8


def sb_search(query: str) -> list[str]:
    """Control: Spell Book's own keyword search. Returns the result lines (name/id/lang/tags)."""
    try:
        out = subprocess.run(["sb", "search", query], capture_output=True, text=True,
                             timeout=30, cwd=str(config.resolve_lib()))
        lines = [l.strip() for l in out.stdout.splitlines() if l.strip()]
        if not lines or lines[0].lower().startswith("no match"):
            return []
        return lines
    except Exception as e:
        return [f"<sb error: {e}>"]


def sb_ids(lines: list[str]) -> list[str]:
    ids = []
    for l in lines:
        if "[" in l and "]" in l:
            ids.append(l[l.index("[") + 1:l.index("]")])
    return ids


def main():
    idx = SidecarIndex.load(config.VECTORS_PATH, config.MANIFEST_PATH)
    if idx.is_empty():
        print("index empty — run `sync` first", file=sys.stderr)
        sys.exit(2)

    needs = [json.loads(l) for l in (HERE / "needs_v2.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    results = []
    print(f"mode={MODE}  top_k={TOP_K}  needs={len(needs)}\n")
    for n in needs:
        hits = engine.rank(idx, n["need"], MODE, top_k=TOP_K)
        top = []
        for eid, score, sim, imp in hits:
            m = idx.meta(eid)
            top.append({"id": eid, "name": m["name"], "language": m["language"],
                        "score": round(float(score), 4),
                        "contract": (m.get("contract") or "")})
        sb_lines = sb_search(n["obvious_query"])
        results.append({**n, "hits": top, "sb_query": n["obvious_query"],
                        "sb_hits": sb_lines, "sb_ids": sb_ids(sb_lines)})

        print(f"=== {n['id']} [{n['expect']}]  {n['need']}")
        print(f"    tool top-8 (score):")
        for r, h in enumerate(top, 1):
            print(f"      {r}. {h['score']:.3f}  {h['name'][:34]:34} [{h['language']}]  {h['id']}")
        if sb_lines:
            print(f"    sb search '{n['obvious_query']}':")
            for l in sb_lines[:8]:
                print(f"      - {l}")
        else:
            print(f"    sb search '{n['obvious_query']}':  No matches.")
        print()

    out = HERE / "battery_v2_results.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass
    main()
