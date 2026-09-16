"""Bridge to the research retrieval engine (prototype/ambient).

This is the ONE place that touches the model. `_backend()` is the swap point: when someone
ships a real local/hosted model service, replace its body — nothing else in the tool changes.
For v1 we just load the machine's resources (Qwen 3B + MiniLM) via the existing backend, as a
black-box service. bf16 on the GPU fits a 3B in 8GB alongside the encoder.
"""
from __future__ import annotations

import sys

import numpy as np

from . import config
from .index import SidecarIndex
from .library import Entry

# Make the research engine importable (mirrors prototype/run.py's bootstrap).
sys.path.insert(0, str(config.PROTO))

from ambient.backends import get_backend            # noqa: E402
from ambient.config import RunConfig                # noqa: E402
from ambient.retrieval import build_query, QueryBuildError  # noqa: E402
from ambient.store import MemoryStore               # noqa: E402

_BACKEND = None


class _EmbedOnlyBackend:
    """The 'tiny' profile: MiniLM embedder alone, no LM loaded (nothing to download beyond the
    ~90MB encoder). Implements only `embed`; `importance` is neutral (importance is off) and
    `generate` must never be called (tiny profile uses query_mode=prompt_text, which embeds the
    raw problem — see ambient.retrieval.build_query).

    The embed path MIRRORS ambient.backends.TransformersBackend.embed EXACTLY (same MiniLM, mean
    pool over last hidden state with attention mask, L2 normalize) so vectors are bit-compatible
    with the quality profile. If that method changes upstream, change it here too.
    """

    name = "embed_only"

    def __init__(self, embed_model_id: str):
        import torch
        from transformers import AutoModel, AutoTokenizer
        self.torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.embed_tok = AutoTokenizer.from_pretrained(embed_model_id)
        self.embed_model = AutoModel.from_pretrained(embed_model_id).to(self.device).eval()

    def _mean_pool(self, last_hidden, mask):
        mask = mask.unsqueeze(-1).type_as(last_hidden)
        summed = (last_hidden * mask).sum(1)
        counts = mask.sum(1).clamp(min=1e-9)
        return summed / counts

    def embed(self, texts):
        torch = self.torch
        with torch.no_grad():
            enc = self.embed_tok(texts, padding=True, truncation=True, max_length=512,
                                 return_tensors="pt").to(self.device)
            out = self.embed_model(**enc, output_hidden_states=True)
            hs = out.hidden_states[-1] if hasattr(out, "hidden_states") else out.last_hidden_state
            vecs = self._mean_pool(hs, enc["attention_mask"]).float().cpu().numpy()
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return vecs / norms

    def importance(self, text: str) -> float:
        return 0.0   # importance is OFF for the static corpus; nothing reads this

    def generate(self, prompt: str, max_new_tokens: int = 64) -> str:
        raise RuntimeError("tiny profile has no LM; query_mode must be prompt_text")


def _backend():
    """The provided model service, chosen by config.MODEL_PROFILE. Loaded once, lazily.

    tiny    -> MiniLM only (no LM downloaded/loaded).
    quality -> Qwen 3B (query rewording) + MiniLM (embeddings), via the research backend.
    Both embed with the SAME MiniLM, so the index is profile-independent (see config note)."""
    global _BACKEND
    if _BACKEND is None:
        if config.MODEL_PROFILE == "tiny":
            _BACKEND = _EmbedOnlyBackend(config.EMBED_ID)
        else:
            _BACKEND = get_backend("transformers", model_id=config.MODEL_ID,
                                   embed_model_id=config.EMBED_ID)
    return _BACKEND


def _run_config(query_mode: str) -> RunConfig:
    # Static corpus: no conversation dynamics, so recency/frequency are neutral (every entry
    # shares t=0). Ranking is proximity (cosine) alone — graded.
    #
    # importance is OFF, on purpose. The 3B attention-importance is a *conversational* salience
    # signal (how much a turn mattered in a dialogue). A code library has no such signal: the
    # battery showed importance is near-flat (~0.02-0.04) except a handful of outliers
    # (AimSystem/AABB/AabbResolver at 0.34-0.41) that then hijacked rank-1 on unrelated queries
    # and demoted the higher-cosine correct spell. Multiplying by it only injects noise here.
    return RunConfig(name="spellbook", query_mode=query_mode,
                     importance_mode="off", proximity_mode="graded")


def expansion(problem: str, query_mode: str) -> str:
    """The text that actually gets embedded as the query — the model's imagined solution for
    the generate modes, or the raw probe for prompt_text. Diagnostic only (explains misses);
    mirrors the generation in ambient.retrieval.build_query."""
    if query_mode == "prompt_text":
        return problem
    from ambient.retrieval import (_HYDE_PROMPT, _ECHO_PROMPT, _ABSTRACT_HYDE_PROMPT,
                                    _ANALOGY_EXAMPLE_PROMPT)
    tmpl = {"hyde": _HYDE_PROMPT, "self_echo": _ECHO_PROMPT,
            "abstract_hyde": _ABSTRACT_HYDE_PROMPT, "analogy_example": _ANALOGY_EXAMPLE_PROMPT}
    if query_mode not in tmpl:
        return ""
    be = _backend()
    return be.generate(tmpl[query_mode].format(probe=problem),
                       max_new_tokens=96 if query_mode == "analogy_example" else 64)


# ---- sync side: embed + importance for a delta of entries ----
def compute_fn(entries: list[Entry]) -> list[tuple[np.ndarray, float]]:
    be = _backend()
    texts = [e.compose() for e in entries]
    vecs = be.embed(texts)
    return [(vecs[i], be.importance(texts[i])) for i in range(len(entries))]


# ---- read side: build query, rank the cached corpus ----
def rank(index: SidecarIndex, problem: str, query_mode: str, top_k: int = 5):
    """Return [(entry_id, score, similarity, importance)] best-first, plus the query text used.

    Rebuilds a MemoryStore from cached (vector, importance) so scoring is identical to the
    research engine; only the query hits the model.
    """
    cfg = _run_config(query_mode)
    be = _backend()
    qvec = build_query(be, problem, cfg)   # may raise QueryBuildError

    store = MemoryStore(cfg)
    ids, _ = index.matrix()
    for i in ids:
        m = index.meta(i)
        store.add(mid=i, text="", t=0, vec=index._vecs[i], importance=float(m["importance"]))
    scored = store.rank(qvec, now=0)[:top_k]
    return [(s.mid, s.score, s.sim, s.importance) for s in scored]


__all__ = ["compute_fn", "rank", "RunConfig", "QueryBuildError"]
