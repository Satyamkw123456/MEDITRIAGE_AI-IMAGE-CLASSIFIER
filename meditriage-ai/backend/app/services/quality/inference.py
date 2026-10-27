from typing import Optional, List, Dict, Any
from app.schemas.ai import DiagnosisItem

def calculate_quality_inference(
    rule_triage_level: str,
    llm_urgency: Optional[str] = None,
    completeness_score: float = 100.0,
    consistency_score: float = 100.0,
    is_emergency: bool = False,
    top_differential: Optional[DiagnosisItem] = None,
    symptoms: Optional[List[Dict[str, Any]]] = None,
    vitals: Optional[Dict[str, Any]] = None,
    engine_error: bool = False,
    needs_clinician_review: bool = False,
    engine_votes: Optional[List[str]] = None,
    consensus_result: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Calculates Tier 3 quality inference metrics:
    - Rule-LLM Agreement
    - Evidence Density
    - Composite Score
    - Confidence Band
    """
    if consensus_result:
        engine_error = engine_error or bool(getattr(consensus_result, "engine_errors", []))
        needs_clinician_review = needs_clinician_review or getattr(consensus_result, "needs_clinician_review", False)
        rule_ids = getattr(consensus_result, "rule_ids", []) or []
        if any("IMPLAUSIBLE" in r for r in rule_ids):
            engine_error = True
        if not engine_votes and getattr(consensus_result, "votes", None):
            engine_votes = [v.level for v in consensus_result.votes if hasattr(v, "level")]

    
    # 1. Multi-Engine & Rule-LLM Agreement Check
    urgency_map = {
        "Emergency": 3,
        "Urgent": 2,
        "Routine": 1,
        "Self-Care Info": 0,
        "Self-Care": 0,
        "Self_Care": 0,
    }
    
    # Calculate rank distance across independent engine votes and LLM
    all_ranks = []
    if engine_votes:
        for v in engine_votes:
            if v and v in urgency_map:
                all_ranks.append(urgency_map[v])
            elif v:
                clean_v = v.strip().title()
                all_ranks.append(urgency_map.get(clean_v, 1))

    rule_val = urgency_map.get(rule_triage_level, 1)
    all_ranks.append(rule_val)
    if llm_urgency:
        clean_llm = llm_urgency.strip().title()
        all_ranks.append(urgency_map.get(clean_llm, rule_val))

    max_dist = (max(all_ranks) - min(all_ranks)) if all_ranks else 0
    
    if max_dist == 0:
        agreement_score = 1.0
    elif max_dist == 1:
        agreement_score = 0.6
    else:
        agreement_score = 0.0

    # 2. Evidence Density Check
    # Heuristic: Check how many distinct symptoms/vitals appear in the evidence text,
    # and penalize for language indicating missing data.
    evidence_density = 0.5  # Base score
    if top_differential and top_differential.evidence:
        evidence_text = top_differential.evidence.lower()
        
        # Positive points for specific symptoms
        matches = 0
        for sym in (symptoms or []):
            if isinstance(sym, dict):
                sym_name = sym.get("symptom", "").lower()
                if sym_name and sym_name in evidence_text:
                    matches += 1
        
        # Positive points for vitals
        if vitals:
            if "temperature" in evidence_text or "fever" in evidence_text or "°f" in evidence_text: matches += 1
            if "blood pressure" in evidence_text or "bp" in evidence_text: matches += 1
            if "pulse" in evidence_text or "bpm" in evidence_text or "heart rate" in evidence_text: matches += 1
            if "spo2" in evidence_text or "oxygen" in evidence_text or "saturation" in evidence_text: matches += 1
        
        evidence_density += (matches * 0.1)
        
        # Penalties for defaults / vague absent data language
        penalties = ["unknown", "not recorded", "none reported", "unspecified"]
        for p in penalties:
            if p in evidence_text:
                evidence_density -= 0.1
                
        # Clamp between 0.0 and 1.0
        evidence_density = max(0.0, min(1.0, evidence_density))
    else:
        evidence_density = 0.0
        
    # 3. Composite Score
    # QualityScore = (0.35 x Completeness) + (0.20 x Consistency) + (0.25 x Agreement) + (0.20 x Evidence Density)
    composite = (0.35 * completeness_score) + (0.20 * consistency_score) + (0.25 * agreement_score) + (0.20 * evidence_density)
    composite_quality_score = round(composite, 2)
    
    # 4. Confidence Band
    if is_emergency and rule_triage_level == "Emergency":
        confidence_band = None
        composite_quality_score = None
    elif engine_error or (llm_urgency and agreement_score == 0.0):
        confidence_band = "Low"
    else:
        if composite_quality_score >= 0.75:
            # High band is forbidden when agreement < 1.0 or needs_clinician_review
            if agreement_score < 1.0 or needs_clinician_review:
                confidence_band = "Medium"
            else:
                confidence_band = "High"
        elif 0.50 <= composite_quality_score < 0.75:
            confidence_band = "Medium"
        else:
            confidence_band = "Low"
            
    return {
        "agreement_score": agreement_score,
        "evidence_density_score": evidence_density,
        "composite_quality_score": composite_quality_score,
        "confidence_band": confidence_band
    }
