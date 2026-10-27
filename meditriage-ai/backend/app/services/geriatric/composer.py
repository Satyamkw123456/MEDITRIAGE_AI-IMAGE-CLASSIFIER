from enum import IntEnum
from dataclasses import dataclass
from typing import List, Set, Optional


class Level(IntEnum):
    SELF_CARE = 0
    ROUTINE = 1
    URGENT = 2
    EMERGENCY = 3

    @classmethod
    def from_str(cls, val: str) -> "Level":
        mapping = {
            "self_care": cls.SELF_CARE,
            "self-care": cls.SELF_CARE,
            "self_care_info": cls.SELF_CARE,
            "self-care info": cls.SELF_CARE,
            "info": cls.SELF_CARE,
            "routine": cls.ROUTINE,
            "urgent": cls.URGENT,
            "emergency": cls.EMERGENCY
        }
        clean = val.strip().lower()
        if clean not in mapping:
            raise ValueError(f"Unknown triage level: {val}")
        return mapping[clean]

    def to_display(self) -> str:
        names = {
            Level.SELF_CARE: "Self-Care Info",
            Level.ROUTINE: "Routine",
            Level.URGENT: "Urgent",
            Level.EMERGENCY: "Emergency"
        }
        return names[self]


@dataclass(frozen=True, slots=True)
class Vote:
    source: str
    level: Level
    rationale: str


@dataclass(frozen=True, slots=True)
class Decision:
    level: Level
    votes: tuple[Vote, ...]
    forbidden: frozenset[Level]


def compose(votes: List[Vote], forbidden: Optional[Set[Level]] = None) -> Decision:
    """
    Escalate-only composition engine (INV-03).
    - final_level = max(all votes)
    - forbid_levels can only push UP
    - under no circumstances can level be lower than max input vote
    """
    if forbidden is None:
        forbidden = set()

    if not votes:
        votes = [Vote(source="DEFAULT_BASELINE", level=Level.SELF_CARE, rationale="Default baseline intake tier")]

    level = max(v.level for v in votes)
    while level in forbidden and level < Level.EMERGENCY:
        level = Level(level + 1)

    return Decision(level, tuple(votes), frozenset(forbidden))
