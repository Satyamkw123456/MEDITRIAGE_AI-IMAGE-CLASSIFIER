from typing import Dict, Any, List, Tuple
import re


STANDARD_DISCLAIMER = (
    "\n\n---\n*Disclaimer: MediTriage AI provides assistive clinical decision-support and health information. "
    "It does not provide definitive medical diagnoses or prescribe medication dosages. "
    "Always consult a qualified healthcare professional regarding any medical condition or treatment.*"
)

# Regex patterns for dosing suggestions
DOSING_PATTERNS = [
    r"\b(take|administer|consume|ingest|use)\s+\d+(\.\d+)?\s*(mg|g|mcg|ml|drops?|tablets?|pills?|capsules?|doses?)\b",
    r"\b\d+(\.\d+)?\s*(mg|g|mcg|ml|drops?|tablets?|pills?|capsules?)\s+(daily|twice|thrice|per\s+day|every\s+\d+\s+hours?)\b",
    r"\b(increase|decrease|double|halve)\s+(your\s+)?(dose|dosage)\b",
]

# Banned imperatives regarding prescription medications
BANNED_IMPERATIVES = [
    (r"\b(stop\s+taking|stop\s+use\s+of|stop\s+the|discontinue|cease|quit\s+taking)\s+([a-zA-Z0-9_\-]+)", r"discuss continuing or adjusting \2 with your doctor"),
    (r"\b(do\s+not\s+take|don't\s+take)\s+([a-zA-Z0-9_\-]+)", r"consult your prescribing physician before taking \2"),
]

# Definitive diagnostic assertions to convert into possibility/differential language
DEFINITIVE_DIAGNOSIS_PATTERNS = [
    (r"\b(you\s+have|you\s+are\s+suffering\s+from|the\s+diagnosis\s+is|this\s+is\s+definitely)\s+([a-zA-Z0-9_\s\-]+?)([\.,;\n])", r"possible clinical considerations may include \2\3"),
    (r"\b(i\s+diagnose\s+you\s+with|confirmed\s+case\s+of)\s+([a-zA-Z0-9_\s\-]+?)([\.,;\n])", r"a physician should evaluate for possible \2\3"),
]


class PostFilter:
    """
    Post-filter guardrail for all outgoing LLM chat responses.
    Enforces:
      1. Stripping/blocking specific numerical dosing advice.
      2. Replacing banned imperatives ('stop taking X' -> 'discuss with your doctor').
      3. Softening definitive diagnosis claims to possibility language.
      4. Ensuring source citation chips on clinical claims.
      5. Appending standard non-diagnostic disclaimer.
    """

    @classmethod
    def filter_response(
        cls,
        text: str,
        citations: List[str] | None = None,
        is_clinician_copilot: bool = False,
    ) -> Tuple[str, Dict[str, Any]]:
        if not text:
            return STANDARD_DISCLAIMER, {"modified": False, "flags": []}

        filtered = text
        flags: List[str] = []

        # 1. Dosing Advice Filter
        dosing_detected = False
        for pat in DOSING_PATTERNS:
            if re.search(pat, filtered, re.IGNORECASE):
                dosing_detected = True
                filtered = re.sub(
                    pat,
                    "[Medication dosage omitted — dosage must be determined solely by your doctor]",
                    filtered,
                    flags=re.IGNORECASE,
                )
        if dosing_detected:
            flags.append("dosing_scrubbed")

        # 2. Banned Imperatives Filter
        for pattern, replacement in BANNED_IMPERATIVES:
            if re.search(pattern, filtered, re.IGNORECASE):
                flags.append("banned_imperative_mitigated")
                filtered = re.sub(pattern, replacement, filtered, flags=re.IGNORECASE)

        # 3. Definitive Diagnosis Filter
        for pattern, replacement in DEFINITIVE_DIAGNOSIS_PATTERNS:
            if re.search(pattern, filtered, re.IGNORECASE):
                flags.append("definitive_diagnosis_softened")
                filtered = re.sub(pattern, replacement, filtered, flags=re.IGNORECASE)

        # 4. Citation Chips Integration
        clean_citations = [c.strip() for c in (citations or []) if c and c.strip()]
        if clean_citations:
            citation_chips = " ".join([f"`[{c}]`" for c in clean_citations])
            if "[Sources:" not in filtered:
                filtered += f"\n\n**Referenced Evidence**: {citation_chips}"

        # 5. Append Standard Disclaimer (if not already present)
        if "MediTriage AI provides assistive clinical decision-support" not in filtered:
            filtered += STANDARD_DISCLAIMER

        return filtered, {
            "modified": len(flags) > 0,
            "flags": flags,
            "citations_count": len(clean_citations),
        }
