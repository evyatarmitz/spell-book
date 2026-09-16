"""Command line for the Spell Book sidecar indexer.

    python -m spindex status              library + sidecar state, staleness
    python -m spindex sync                re-index changed/new/removed entries
    python -m spindex find "<problem>"    ambient retrieval over the library
    python -m spindex ab   "<problem>"    sb keyword search vs ambient, side by side

Run under the CUDA venv:  ./.venv-cuda/Scripts/python.exe -m spindex ...
"""
from __future__ import annotations

import argparse
import subprocess
import sys

from . import config
from .index import SidecarIndex
from .library import Entry, load_entries

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass


def _load_index() -> SidecarIndex:
    return SidecarIndex.load(config.VECTORS_PATH, config.MANIFEST_PATH)


def _staleness(entries: list[Entry], index: SidecarIndex) -> tuple[int, int, int]:
    """(new, changed, removed) counts vs the current library — hash-only, no model."""
    cur = {e.id: e for e in entries}
    old = set(index.manifest)
    new = set(cur)
    changed = sum(1 for i in (new & old)
                  if index.manifest[i].get("hash") != cur[i].content_hash())
    return len(new - old), changed, len(old - new)


def _fmt(entry_id: str, meta: dict, lib) -> str:
    tags = ", ".join(meta.get("tags") or [])
    src = lib / meta.get("source", "") if meta.get("source") else ""
    line = f"  {meta.get('name', entry_id)}  [{entry_id}]  {meta.get('language', '')}"
    if tags:
        line += f"  <{tags}>"
    body = f"      {meta.get('contract', '')}".rstrip()
    tail = f"      {src}" if src else ""
    return "\n".join(p for p in (line, body, tail) if p.strip())


def cmd_status(args):
    lib = config.resolve_lib(args.lib)
    entries = load_entries(lib)
    index = _load_index()
    print(f"Library : {lib}  ({len(entries)} entries)")
    print(f"Sidecar : {config.DATA_DIR}  ({len(index.manifest)} indexed)")
    if index.is_empty():
        print("Status  : empty — run `sync`")
        return
    n, c, r = _staleness(entries, index)
    if n or c or r:
        print(f"Status  : STALE — +{n} new  ~{c} changed  -{r} removed  (run `sync`)")
    else:
        print("Status  : up to date")


def cmd_sync(args):
    lib = config.resolve_lib(args.lib)
    entries = load_entries(lib)
    index = _load_index()
    from . import engine  # heavy import (torch) deferred to when we actually embed
    print(f"Syncing {len(entries)} entries from {lib} ...")
    rep = index.sync(entries, engine.compute_fn)
    index.save()
    print(rep)
    for i in rep.added:
        print(f"  + {i}")
    for i in rep.changed:
        print(f"  ~ {i}")
    for i in rep.removed:
        print(f"  - {i}")


def cmd_find(args):
    lib = config.resolve_lib(args.lib)
    index = _load_index()
    if index.is_empty():
        print("Sidecar index is empty. Run `sync` first.", file=sys.stderr)
        sys.exit(2)
    entries = load_entries(lib)
    n, c, r = _staleness(entries, index)
    if n or c or r:
        print(f"[warn] index STALE (+{n} ~{c} -{r}); results may miss recent entries. "
              f"Run `sync`.\n", file=sys.stderr)
    from . import engine
    try:
        hits = engine.rank(index, args.query, args.mode, top_k=args.k)
    except engine.QueryBuildError as e:
        print(f"query construction failed: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"query mode: {args.mode}   top {args.k}\n")
    for rank_i, (eid, score, sim, imp) in enumerate(hits, 1):
        meta = index.meta(eid)
        print(f"{rank_i}. score={score:.3f}  sim={sim:.3f}  imp={imp:.2f}")
        print(_fmt(eid, meta, lib))
        print()


def _sb_search(query: str, k: int) -> list[str]:
    try:
        out = subprocess.run(["sb", "search", query], capture_output=True, text=True, timeout=30)
        lines = [l for l in out.stdout.splitlines() if l.strip()]
        return lines[:k]
    except Exception as e:
        return [f"(sb search failed: {e})"]


def cmd_ab(args):
    lib = config.resolve_lib(args.lib)
    index = _load_index()
    if index.is_empty():
        print("Sidecar index is empty. Run `sync` first.", file=sys.stderr)
        sys.exit(2)
    print(f'QUERY: "{args.query}"\n')
    print("=== sb search (keyword) ===")
    for l in _sb_search(args.query, args.k):
        print("  " + l)
    print(f"\n=== ambient ({args.mode}) ===")
    from . import engine
    try:
        hits = engine.rank(index, args.query, args.mode, top_k=args.k)
    except engine.QueryBuildError as e:
        print(f"  query construction failed: {e}")
        return
    for rank_i, (eid, score, sim, imp) in enumerate(hits, 1):
        meta = index.meta(eid)
        tags = ", ".join(meta.get("tags") or [])
        print(f"  {rank_i}. {meta.get('name', eid)}  [{eid}]  {meta.get('language','')}  <{tags}>")


def main(argv=None):
    p = argparse.ArgumentParser(prog="spindex", description="Spell Book ambient-memory sidecar (v1)")
    p.add_argument("--lib", help="library path (default: $SPELLBOOK_LIB or `sb status`)")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="library + sidecar state").set_defaults(fn=cmd_status)
    sub.add_parser("sync", help="incremental re-index").set_defaults(fn=cmd_sync)

    pf = sub.add_parser("find", help="ambient retrieval")
    pf.add_argument("query")
    pf.add_argument("--mode", default=config.DEFAULT_QUERY_MODE,
                    choices=["abstract_hyde", "analogy_example", "hyde", "self_echo", "prompt_text"])
    pf.add_argument("-k", type=int, default=5)
    pf.set_defaults(fn=cmd_find)

    pa = sub.add_parser("ab", help="sb keyword vs ambient")
    pa.add_argument("query")
    pa.add_argument("--mode", default=config.DEFAULT_QUERY_MODE,
                    choices=["abstract_hyde", "analogy_example", "hyde", "self_echo", "prompt_text"])
    pa.add_argument("-k", type=int, default=5)
    pa.set_defaults(fn=cmd_ab)

    args = p.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
