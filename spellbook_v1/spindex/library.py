"""Read the Spell Book library (READ-ONLY) and turn each entry into retrievable text.

Storage layout (discovered from a real 268-entry library):
    <lib>/index.json   list[ {id,name,language,status,origin,tags,contract,inputs,
                              outputs,scars,notes,source,created_at,updated_at}, ... ]
    <lib>/sources/*    one code file per entry (referenced by entry["source"])

We embed the *semantic surface* (name/contract/scars/tags/io/notes), NOT the full source:
source is long and dilutes the vector, and the whole point of the memory line is that the
contract+scars carry the logical/causal content plain keyword search misses. Source stays a
display pointer.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Entry:
    id: str
    name: str
    language: str
    tags: list[str]
    contract: str
    inputs: str
    outputs: str
    scars: str
    notes: str
    source: str          # relative path into <lib>, e.g. "sources/ecs-world-ti-ts.ts"

    def compose(self) -> str:
        """The text that represents this entry in vector space. Empty fields are dropped so a
        sparse entry isn't padded with blank labels that blur its meaning."""
        parts: list[str] = []
        head = self.name + (f" ({self.language})" if self.language else "")
        if self.contract:
            parts.append(f"{head}. {self.contract}")
        else:
            parts.append(head)
        if self.tags:
            parts.append("Tags: " + ", ".join(self.tags) + ".")
        if self.inputs:
            parts.append("Inputs: " + self.inputs)
        if self.outputs:
            parts.append("Outputs: " + self.outputs)
        if self.scars:
            parts.append("Scars: " + self.scars)
        if self.notes:
            parts.append("Notes: " + self.notes)
        return "\n".join(parts)

    def content_hash(self) -> str:
        """Change detection key. Hash the composed text — any field change that moves the
        vector changes this; cosmetic-only fields (status, timestamps) do not, so they don't
        trigger a needless re-embed."""
        return hashlib.sha256(self.compose().encode("utf-8")).hexdigest()[:16]


def _entry(d: dict) -> Entry:
    return Entry(
        id=d["id"],
        name=d.get("name", d["id"]),
        language=(d.get("language") or "").lower(),
        tags=list(d.get("tags") or []),
        contract=d.get("contract") or "",
        inputs=d.get("inputs") or "",
        outputs=d.get("outputs") or "",
        scars=d.get("scars") or "",
        notes=d.get("notes") or "",
        source=d.get("source") or "",
    )


def load_entries(lib: Path) -> list[Entry]:
    """Parse index.json into Entry objects. Read-only; the library is never modified."""
    idx = lib / "index.json"
    if not idx.exists():
        raise FileNotFoundError(f"no index.json at {idx} (is {lib} a Spell Book library?)")
    raw = json.loads(idx.read_text(encoding="utf-8"))
    rows = raw if isinstance(raw, list) else (raw.get("entries") or list(raw.values()))
    return [_entry(d) for d in rows if d.get("id")]
