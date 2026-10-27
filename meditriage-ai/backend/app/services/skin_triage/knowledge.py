"""Dermatology knowledge retrieval (RAG) over the Triage Flow corpus.

Pure-python TF-IDF cosine retrieval: zero heavy dependencies, deterministic, and
fully testable. The retrieval interface is intentionally narrow so a vector store
(Chroma/pgvector) can replace it later without touching the pipeline.
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from app.services.skin_triage.taxonomy import class_for_label, normalize_label

_DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "skin_rag.json"
_TOKEN = re.compile(r"[a-z0-9]{3,}")
_STOP = frozenset(
    "the and for with that this from are was were have has had can may will not but its into "
    "also such when which their they them than then more most other some any all one two".split()
)


def _tokens(text: str) -> List[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]


class KnowledgeBase:
    def __init__(self, entries: List[Dict[str, str]]):
        self.entries = entries
        self._by_norm = {normalize_label(e["id"]): e for e in entries}
        docs = [Counter(_tokens(f"{e['id']} {e['data']}")) for e in entries]
        df: Counter = Counter()
        for d in docs:
            df.update(d.keys())
        n = max(len(docs), 1)
        self._idf = {t: math.log((1 + n) / (1 + c)) + 1.0 for t, c in df.items()}
        self._vecs = [self._weigh(d) for d in docs]

    def _weigh(self, counts: Counter) -> Dict[str, float]:
        vec = {t: (1 + math.log(c)) * self._idf.get(t, 1.0) for t, c in counts.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {t: v / norm for t, v in vec.items()}

    def get(self, label: str) -> Optional[Dict[str, str]]:
        return self._by_norm.get(normalize_label(label))

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, object]]:
        q = self._weigh(Counter(_tokens(query)))
        if not q:
            return []
        scored = []
        for e, v in zip(self.entries, self._vecs):
            s = sum(w * v.get(t, 0.0) for t, w in q.items())
            if s > 0:
                scored.append((s, e))
        scored.sort(key=lambda x: x[0], reverse=True)
        out = []
        for s, e in scored[:top_k]:
            c = class_for_label(e["id"])
            out.append({"id": c.name if c else e["id"], "data": e["data"], "score": round(float(s), 4)})
        return out


@lru_cache(maxsize=1)
def get_knowledge_base() -> KnowledgeBase:
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return KnowledgeBase(json.load(f))
