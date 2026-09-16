"""Paths and model identity for the Spell Book sidecar indexer (v1).

This tool is READ-ONLY against the Spell Book library: it parses index.json and the
sources/ dir, builds its OWN vector index in spellbook_v1/data/, and never calls `sb add`.

The model backend (3B LM for query construction + importance, MiniLM for embeddings) is
treated as a provided service — see engine.get_backend. Swapping in a real hosted model
interface later is a one-function change there.
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

# spindex/config.py -> spindex -> spellbook_v1 -> <repo root>
PKG_DIR = Path(__file__).resolve().parent
TOOL_DIR = PKG_DIR.parent                 # spellbook_v1/
REPO = TOOL_DIR.parent                    # the elephant project/

# Where the `ambient` engine package lives. On a dev checkout it's <repo>/prototype; on a
# consumer machine the install toggle drops the Elephant engine somewhere and points
# $ELEPHANT_HOME at it (the dir that CONTAINS the `ambient/` package). This is the ONE path
# that makes the folder portable — nothing else assumes the repo layout.
_ELEPHANT_HOME = os.environ.get("ELEPHANT_HOME")
PROTO = Path(_ELEPHANT_HOME) if _ELEPHANT_HOME else (REPO / "prototype")

# Sidecar index output (self-contained inside the tool dir; git-ignored, regenerable).
DATA_DIR = TOOL_DIR / "data"
VECTORS_PATH = DATA_DIR / "vectors.npz"
MANIFEST_PATH = DATA_DIR / "manifest.json"

# ---- Model profile: the "tiny vs 3B" button --------------------------------------------------
# Two interchangeable profiles the consumer picks at install (Spell Book exposes it as a toggle):
#
#   tiny    : MiniLM embedder ONLY (~90MB, CPU-fine). Entries are embedded with MiniLM and a
#             search embeds the raw problem directly (query_mode=prompt_text). No 3B downloaded,
#             no generation ever runs.
#   quality : same MiniLM entry embeddings, but a search first rewords the problem with the 3B
#             (query_mode=abstract_hyde) before embedding — the validated higher-recall path.
#
# CRITICAL INVARIANT: entry embeddings are IDENTICAL across profiles (both MiniLM, same pooling).
# The 3B only ever touches the QUERY, never the corpus — so an index built under one profile is
# valid under the other. The button changes search quality, not the stored vectors.
MODEL_PROFILE = os.environ.get("SPINDEX_MODEL_PROFILE", "quality").lower()

EMBED_ID = "sentence-transformers/all-MiniLM-L6-v2"   # the "tiny model"; always the embedder
MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"                 # the "3B"; query rewording only (quality)

# Query mode follows the profile (override per-call in the CLI with --mode for A/B testing).
_PROFILE_QUERY_MODE = {"tiny": "prompt_text", "quality": "abstract_hyde"}
DEFAULT_QUERY_MODE = _PROFILE_QUERY_MODE.get(MODEL_PROFILE, "abstract_hyde")

# How many candidates a search returns (the wide net). Not a Spell Book knob — Spell Book asks
# for "matches", the engine decides how many. (The future `spread` dial, an Elephant-side change,
# will govern this; see prototype/ambient/ELEPHANT_TODO_temperature_dial.md.)
DEFAULT_TOP_K = 8

_FALLBACK_LIB = Path(r"C:\Users\USER\AI_Agency\Sp-lib")


def resolve_lib(explicit: str | None = None) -> Path:
    """Locate the Spell Book library: --lib arg > $SPELLBOOK_LIB > `sb status` > known path."""
    if explicit:
        return Path(explicit)
    env = os.environ.get("SPELLBOOK_LIB")
    if env:
        return Path(env)
    try:
        out = subprocess.run(["sb", "status"], capture_output=True, text=True, timeout=15)
        for line in out.stdout.splitlines():
            if line.lower().startswith("library:"):
                return Path(line.split(":", 1)[1].strip())
    except Exception:
        pass
    return _FALLBACK_LIB
