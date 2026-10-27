import io
import html
from typing import Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.schemas.intake import CaseDetailOut

def _esc(val: Any) -> str:
    if val is None:
        return ""
    return html.escape(str(val))

def generate_case_pdf(case: CaseDetailOut) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = styles["Heading1"]
    title_style.alignment = 1 # Center
    
    h2 = styles["Heading2"]
    
    normal = styles["Normal"]
    
    alert_style = ParagraphStyle(
        "Alert",
        parent=normal,
        textColor=colors.white,
        backColor=colors.red,
        borderPadding=6,
        spaceAfter=12
    )

    Story = []
    
    # Header
    Story.append(Paragraph(f"Clinical Case Report: #{_esc(case.id)}", title_style))
    Story.append(Spacer(1, 0.25 * inch))
    
    # Status and Emergency Banner
    if case.is_emergency_flag:
        Story.append(Paragraph(f"<b>EMERGENCY CASE</b><br/>Rule Fired: {_esc(case.emergency_rule_fired)}", alert_style))
    
    created_at_str = case.created_at.strftime("%Y-%m-%d") if hasattr(case.created_at, "strftime") else str(case.created_at).split('T')[0]
    status_text = f"<b>Review Status:</b> {_esc(case.status.capitalize())} | <b>Created At:</b> {_esc(created_at_str)}"
    Story.append(Paragraph(status_text, normal))
    Story.append(Spacer(1, 0.2 * inch))
    
    # Patient Demographics
    Story.append(Paragraph("Patient Demographics", h2))
    demo_data = [
        ["Patient ID", _esc(case.patient_id)],
        ["Age", _esc(case.patient_age) if case.patient_age else "Unknown"],
        ["Sex", _esc(case.patient_sex) if case.patient_sex else "Unknown"]
    ]
    t_demo = Table(demo_data, colWidths=[2 * inch, 4 * inch])
    t_demo.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    Story.append(t_demo)
    Story.append(Spacer(1, 0.2 * inch))

    # Intake Summary
    Story.append(Paragraph("Intake Summary", h2))
    Story.append(Paragraph(f"<b>Chief Complaint:</b> {_esc(case.chief_complaint)}", normal))
    
    if case.symptoms:
        Story.append(Spacer(1, 0.1 * inch))
        Story.append(Paragraph("<b>Symptoms:</b>", normal))
        for sym in case.symptoms:
            sym_text = f"- {_esc(sym.symptom)} (Duration: {_esc(sym.duration)}, Severity: {_esc(sym.severity)}/10, Location: {_esc(sym.body_location)})"
            Story.append(Paragraph(sym_text, normal))

    if case.vitals:
        Story.append(Spacer(1, 0.1 * inch))
        Story.append(Paragraph("<b>Vitals:</b>", normal))
        for v in case.vitals:
            v_text = f"- Temp: {_esc(v.temperature)}°F | Pulse: {_esc(v.pulse)} bpm | BP: {_esc(v.blood_pressure)} | SpO2: {_esc(v.spo2)}%"
            Story.append(Paragraph(v_text, normal))
            
    Story.append(Spacer(1, 0.2 * inch))

    # Triage Level
    if case.triage_result and not case.is_emergency_flag:
        Story.append(Paragraph("Rule-Based Triage", h2))
        Story.append(Paragraph(f"<b>Triage Level:</b> {_esc(case.triage_result.triage_level)}", normal))
        Story.append(Paragraph(f"<b>Risk Score:</b> {_esc(case.triage_result.risk_score)}", normal))
        Story.append(Paragraph(f"<b>Explanation:</b> {_esc(case.triage_result.explanation)}", normal))
        Story.append(Spacer(1, 0.2 * inch))

    # Quality Flags
    if case.quality_score:
        if case.quality_score.flags or case.quality_score.requires_clarification:
            Story.append(Paragraph("Quality Flags & Follow-ups", h2))
            if case.quality_score.flags:
                Story.append(Paragraph(f"<b>Flags:</b> {', '.join([_esc(f) for f in case.quality_score.flags])}", normal))
            if case.quality_score.follow_up_questions:
                Story.append(Paragraph("<b>Follow-up Questions Asked:</b>", normal))
                for q in case.quality_score.follow_up_questions:
                    q_text = getattr(q, 'question', None) or (q.get('question', q.get('question_text', '')) if isinstance(q, dict) else str(q))
                    Story.append(Paragraph(f"- {_esc(q_text)}", normal))
            Story.append(Spacer(1, 0.2 * inch))

    # AI Differentials
    if case.differential_diagnoses:
        Story.append(Paragraph("AI Orchestrator Analysis", h2))
        if case.ai_audit_logs and len(case.ai_audit_logs) > 0:
            log = case.ai_audit_logs[0]
            Story.append(Paragraph(f"<b>AI Summary:</b> {_esc(log.output_summary)}", normal))
            Story.append(Paragraph(f"<b>Model:</b> {_esc(log.model_name)} (Prompt {_esc(log.prompt_version)})", styles["Italic"]))
            Story.append(Spacer(1, 0.1 * inch))
            
        Story.append(Paragraph("<b>Ranked Differential Diagnoses:</b>", normal))
        
        diag_data = [["Condition", "Probability", "Evidence"]]
        for d in case.differential_diagnoses:
            diag_data.append([
                Paragraph(_esc(d.condition_name), normal),
                f"{int(d.probability_score * 100)}%",
                Paragraph(_esc(d.evidence), normal)
            ])
            
        t_diag = Table(diag_data, colWidths=[2 * inch, 1 * inch, 3 * inch])
        t_diag.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP')
        ]))
        Story.append(t_diag)

    # Footer Notice (Clinical validation pending)
    Story.append(Spacer(1, 0.3 * inch))
    footer_style = ParagraphStyle(
        "FooterNotice",
        parent=normal,
        fontName="Helvetica-Oblique",
        fontSize=8,
        textColor=colors.gray,
        alignment=1,  # Center
    )
    Story.append(Paragraph("Geriatric escalation rules pending clinical validation", footer_style))

    doc.build(Story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
