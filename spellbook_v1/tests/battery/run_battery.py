"""Run the invented-needs battery through the SB-elephant retriever and dump results.

Methodology: the needs in needs.jsonl were authored BLIND (problem-level, no peeking at what the
library actually contains), tagged with an expectation:
    match   -> a fitting spell probably exists; the top hit should be it
    closest -> probably no exact spell; test whether the nearest returned is a sensible neighbour
    none    -> out of domain; ideally the retriever brings nothing (there is no abstain flow yet,
               so instead we check the top score stays LOW enough that a threshold could abstain)

This script only RUNS retrieval and records scores. The human judgement (were these the right
spells? is there score separation for an abstain cutoff?) happens after, against the library.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOL = HERE.parent.parent                      # spellbook_v1/
sys.path.insert(0, str(TOOL))

from spindex import config, engine             # noqa: E402
from spindex.index import SidecarIndex         # noqa: E402

MODE = "abstract_hyde"
TOP_K = 5


def main():
    idx = SidecarIndex.load(config.VECTORS_PATH, config.MANIFEST_PATH)
    if idx.is_empty():
        print("index empty — run `sync` first", file=sys.stderr)
        sys.exit(2)

    needs = [json.loads(l) for l in (HERE / "needs.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    results = []
    print(f"mode={MODE}  top_k={TOP_K}  needs={len(needs)}\n")
    print(f"{'id':4} {'expect':8} {'top1':6} {'lang✓':5} top-hit")
    print("-" * 78)
    for n in needs:
        exp = engine.expansion(n["need"], MODE)
        hits = engine.rank(idx, n["need"], MODE, top_k=TOP_K)
        top = []
        for eid, score, sim, imp in hits:
            m = idx.meta(eid)
            top.append({"id": eid, "name": m["name"], "language": m["language"],
                        "score": round(float(score), 4), "sim": round(float(sim), 4),
                        "importance": round(float(imp), 3)})
        results.append({**n, "expansion": exp, "hits": top})
        t1 = top[0] if top else {"score": 0, "name": "-", "language": "-"}
        langok = "-" if n["lang"] == "none" else ("yes" if t1["language"] == n["lang"] else "NO")
        print(f"{n['id']:4} {n['expect']:8} {t1['score']:.3f}  {langok:5} "
              f"{t1['name']} [{t1['language']}]")

    out = HERE / "battery_results.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nwrote {out}")

    # quick abstain-separation read: lowest match-score vs highest none-score
    match_scores = [r["hits"][0]["score"] for r in results if r["expect"] == "match" and r["hits"]]
    none_scores = [r["hits"][0]["score"] for r in results if r["expect"] == "none" and r["hits"]]
    if match_scores and none_scores:
        print(f"\nabstain separation:  min(match top1) = {min(match_scores):.3f}   "
              f"max(none top1) = {max(none_scores):.3f}   "
              f"{'SEPARABLE' if min(match_scores) > max(none_scores) else 'OVERLAP — no clean cutoff'}")


if __name__ == "__main__":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass
    main()
