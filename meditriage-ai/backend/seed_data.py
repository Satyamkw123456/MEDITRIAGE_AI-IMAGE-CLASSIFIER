"""
Seed demonstration data for MediTriage AI.
Roles:
- Admin: admin@meditriage.ai / Admin@123 & admin@meditriage.internal / Admin@123
- Clinician: doctor@meditriage.ai / Doctor@123 & dr.ananya@hospital.org / Doctor@123
- Patient: patient@meditriage.ai / Patient@123 & kamla.devi@example.com / SecurePassword123!
Also seeds:
- DPDP 2023 Digital Consents
- Emergency Directory Resources & Emergency Cards
- Submitted Demo Cases across Triage Levels (Urgent Red-Flag, Routine, Self-Care)
- Quality Scores & Differential Diagnoses
- Initial Job Runs
"""
from datetime import datetime, timezone, timedelta
from app.core.config import settings
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.patient import PatientProfile
from app.models.consent import ConsentLog
from app.models.case import Case
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.triage import TriageResult
from app.models.quality import QualityScore
from app.models.diagnosis import DifferentialDiagnosis
from app.models.support_ops import EmergencyResource
from app.models.domain_substrate import EmergencyCard, ConsentsTable, JobRun


def get_utc():
    return datetime.now(timezone.utc)


def seed():
    if settings.ENVIRONMENT != "development":
        raise RuntimeError(
            f"CRITICAL: Refusing to seed demonstration accounts in '{settings.ENVIRONMENT}' environment! "
            "Seeding default accounts is strictly permitted only in 'development'."
        )

    print("\n" + "=" * 80)
    print(" [SEEDING] POPULATING SYSTEM WITH PRODUCTION-LIKE DEMO CLINICAL DATA")
    print("=" * 80 + "\n")

    db = SessionLocal()
    now = get_utc()
    try:
        # 1. USERS & PROFILES
        users_to_seed = [
            {
                "name": "Dr. Ananya Sharma",
                "email": "doctor@meditriage.ai",
                "password": "Doctor@123",
                "role": "clinician",
                "clinician_verification_status": "approved",
                "clinician_registration_number": "MCI-DL-2018-84729",
            },
            {
                "name": "Dr. Ananya Sharma",
                "email": "dr.ananya@hospital.org",
                "password": "Doctor@123",
                "role": "clinician",
                "clinician_verification_status": "approved",
                "clinician_registration_number": "MCI-DL-2018-84729",
            },
            {
                "name": "System Administrator",
                "email": "admin@meditriage.ai",
                "password": "Admin@123",
                "role": "admin",
            },
            {
                "name": "System Administrator",
                "email": "admin@meditriage.internal",
                "password": "Admin@123",
                "role": "admin",
            },
            {
                "name": "Ramesh Kumar",
                "email": "patient@meditriage.ai",
                "password": "Patient@123",
                "role": "patient",
                "age": 72,
                "sex": "male",
                "medical_history": "Hypertension, Type 2 Diabetes, Mild Cognitive Impairment",
                "allergies": "Penicillin",
            },
            {
                "name": "Kamla Devi",
                "email": "kamla.devi@example.com",
                "password": "SecurePassword123!",
                "role": "patient",
                "age": 74,
                "sex": "female",
                "medical_history": "Osteoarthritis, Mild COPD, Hypertension",
                "allergies": "Sulfa drugs",
            },
            {
                "name": "Ananya Sharma",
                "email": "caregiver@meditriage.ai",
                "password": "Caregiver@123",
                "role": "caregiver",
            },
        ]

        user_map = {}
        for u in users_to_seed:
            user = db.query(User).filter(User.email == u["email"]).first()
            if not user:
                user = User(
                    name=u["name"],
                    email=u["email"],
                    password_hash=get_password_hash(u["password"]),
                    role=u["role"],
                    clinician_verification_status=u.get("clinician_verification_status", "approved"),
                    clinician_registration_number=u.get("clinician_registration_number"),
                )
                db.add(user)
                db.flush()
                print(f"Created user: {u['email']} (role: {u['role']})")
            else:
                user.password_hash = get_password_hash(u["password"])
                user.is_suspended = False
                user.failed_login_attempts = 0
                user.locked_until = None
                user.role = u["role"]
                db.flush()
                print(f"User exists, updated password & reset state: {u['email']}")

            user_map[u["email"]] = user

            if u["role"] == "patient":
                profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
                if not profile:
                    profile = PatientProfile(
                        user_id=user.id,
                        age=u.get("age", 70),
                        sex=u.get("sex", "male"),
                        medical_history=u.get("medical_history"),
                        allergies=u.get("allergies"),
                    )
                    db.add(profile)
                    db.flush()
                    print(f"  -> Created PatientProfile for {u['email']}")

        db.commit()

        # 2. DIGITAL CONSENTS (DPDP Act 2023)
        patient_emails = ["patient@meditriage.ai", "kamla.devi@example.com"]
        for p_email in patient_emails:
            p_user = user_map.get(p_email)
            if not p_user:
                continue

            existing_log = db.query(ConsentLog).filter(
                ConsentLog.user_id == p_user.id,
                ConsentLog.granted == True
            ).first()
            if not existing_log:
                consent_log = ConsentLog(
                    user_id=p_user.id,
                    consent_type="triage_evaluation",
                    version="v1.0-dpdp2023",
                    granted=True,
                    granted_by="patient",
                    ip_address="127.0.0.1",
                    created_at=now,
                )
                db.add(consent_log)
                print(f"Created ConsentLog for {p_email}")

            existing_c = db.query(ConsentsTable).filter(ConsentsTable.user_id == p_user.id).first()
            if not existing_c:
                c_table = ConsentsTable(
                    user_id=p_user.id,
                    payload={"granted": True, "version": "v1.0-dpdp2023", "type": "triage_evaluation"},
                    created_at=now,
                    updated_at=now,
                )
                db.add(c_table)

        # 3. EMERGENCY RESOURCES (Pune-First Ordering)
        emergency_resources = [
            {
                "name": "Sassoon General Hospital & Trauma Center",
                "category": "hospital",
                "phone_number": "+91 20 2612 8000",
                "city_region": "Pune, Maharashtra",
            },
            {
                "name": "Pune Municipal Corporation (PMC) Emergency Ambulance (108)",
                "category": "ambulance",
                "phone_number": "108",
                "city_region": "Pune, Maharashtra",
            },
            {
                "name": "KEM Hospital Pune Emergency Room",
                "category": "hospital",
                "phone_number": "+91 20 6603 7300",
                "city_region": "Pune, Maharashtra",
            },
            {
                "name": "National Emergency Integrated Response System",
                "category": "helpline",
                "phone_number": "112",
                "city_region": "National",
            },
            {
                "name": "Elder Care Senior Citizen Helpline",
                "category": "helpline",
                "phone_number": "14567",
                "city_region": "National",
            },
        ]

        for er in emergency_resources:
            existing = db.query(EmergencyResource).filter(EmergencyResource.name == er["name"]).first()
            if not existing:
                res = EmergencyResource(
                    name=er["name"],
                    category=er["category"],
                    phone_number=er["phone_number"],
                    city_region=er["city_region"],
                    last_verified_at=now,
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
                db.add(res)
                print(f"Created EmergencyResource: {er['name']}")

        # 4. EMERGENCY CARDS
        for p_email in patient_emails:
            p_user = user_map.get(p_email)
            if p_user:
                existing_card = db.query(EmergencyCard).filter(EmergencyCard.user_id == p_user.id).first()
                if not existing_card:
                    card = EmergencyCard(
                        user_id=p_user.id,
                        payload={
                            "patient_name": p_user.name,
                            "blood_group": "O+",
                            "emergency_contacts": [
                                {"name": "Aakash Kumar", "phone": "+91-9876543210", "relationship": "Son"}
                            ],
                            "allergies": ["Penicillin"],
                            "chronic_conditions": ["Hypertension", "Type 2 Diabetes"],
                        },
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(card)
                    print(f"Created EmergencyCard for {p_email}")

        # 5. INITIAL JOB RUNS
        job_names = [
            ("cron_audit_chain_verify", "SUCCESS"),
            ("cron_dpdp_sla_monitor", "SUCCESS"),
            ("cron_rag_cache_refresh", "SUCCESS"),
        ]
        for jname, jstatus in job_names:
            existing_j = db.query(JobRun).filter(JobRun.job_name == jname).first()
            if not existing_j:
                db.add(JobRun(
                    job_name=jname,
                    status=jstatus,
                    payload={"details": "System health verified normal."},
                    created_at=now,
                    updated_at=now,
                ))

        db.commit()

        # 6. POPULATE INITIAL DEMO CASES IF EMPTY
        ramesh_user = user_map.get("patient@meditriage.ai")
        kamla_user = user_map.get("kamla.devi@example.com")
        doctor_user = user_map.get("doctor@meditriage.ai")

        ramesh_profile = db.query(PatientProfile).filter(PatientProfile.user_id == ramesh_user.id).first()
        kamla_profile = db.query(PatientProfile).filter(PatientProfile.user_id == kamla_user.id).first()

        existing_cases_count = db.query(Case).count()
        if existing_cases_count <= 1 and ramesh_profile and kamla_profile:
            print("Populating initial demonstration triage cases...")

            # Case 1: Urgent Red-Flag Emergency (Chest Pain & Dyspnea)
            case_1 = Case(
                patient_id=ramesh_profile.id,
                chief_complaint="Severe crushing retrosternal chest pain with diaphoresis and acute shortness of breath",
                status="submitted",
                is_emergency_flag=True,
                emergency_rule_fired="RED-FLAG-CV-01: Acute crushing chest pain radiating to left arm with diaphoresis",
                red_flag_retracted=False,
                ai_status="ready",
                created_at=now - timedelta(minutes=45),
            )
            db.add(case_1)
            db.flush()

            db.add(SymptomEntry(
                case_id=case_1.id,
                symptom="Severe crushing chest pain radiating to left arm",
                duration="45 minutes",
                severity=9,
                body_location="Chest",
            ))
            db.add(Vitals(
                case_id=case_1.id,
                temperature=98.8,
                pulse=110,
                blood_pressure="165/102",
                spo2=91.0,
            ))
            db.add(TriageResult(
                case_id=case_1.id,
                triage_level="Urgent",
                risk_score=94.0,
                explanation="RedFlagEngine triggered: Tier-1 Acute Coronary Syndrome risk. Vitals show tachycardia (110 bpm), hypertensive urgency (165/102 mmHg), and borderline hypoxemia (SpO2 91%). Immediate emergency department evaluation required.",
                fallback_used=False,
                is_current="true",
                source="ENGINE",
                decision_trace={
                    "final_level": "Urgent",
                    "risk_score": 94.0,
                    "votes": [
                        {"source": "RedFlagEngine", "level": "Urgent", "rationale": "Crushing chest pain + left arm radiation"}
                    ]
                },
                created_at=now - timedelta(minutes=45),
            ))
            db.add(QualityScore(
                case_id=case_1.id,
                completeness_score=0.95,
                consistency_score=1.0,
                flags=[],
                requires_clarification=False,
                created_at=now - timedelta(minutes=45),
            ))
            db.add(DifferentialDiagnosis(
                case_id=case_1.id,
                condition_name="Acute Coronary Syndrome (STEMI / NSTEMI)",
                probability_score=0.88,
                evidence="Severe retrosternal crushing chest pain, radiation to left arm, diaphoresis, age 72, male, hypertension history, SpO2 91%.",
                created_at=now - timedelta(minutes=45),
            ))
            db.add(DifferentialDiagnosis(
                case_id=case_1.id,
                condition_name="Aortic Dissection",
                probability_score=0.10,
                evidence="Acute severe chest discomfort with elevated systolic blood pressure (165 mmHg).",
                created_at=now - timedelta(minutes=45),
            ))

            # Case 2: Routine Consultation (Geriatric Joint Pain & Headache)
            case_2 = Case(
                patient_id=kamla_profile.id,
                chief_complaint="Persistent bilateral knee pain, morning stiffness and mild frontal headache for past 4 days",
                status="submitted",
                is_emergency_flag=False,
                emergency_rule_fired=None,
                red_flag_retracted=False,
                ai_status="ready",
                created_at=now - timedelta(hours=3),
            )
            db.add(case_2)
            db.flush()

            db.add(SymptomEntry(
                case_id=case_2.id,
                symptom="Knee pain and morning stiffness",
                duration="4 days",
                severity=5,
                body_location="Lower Extremities",
            ))
            db.add(Vitals(
                case_id=case_2.id,
                temperature=98.4,
                pulse=76,
                blood_pressure="130/84",
                spo2=98.0,
            ))
            db.add(TriageResult(
                case_id=case_2.id,
                triage_level="Routine",
                risk_score=46.0,
                explanation="Geriatric composer decision: Routine. Stable vitals, absence of acute red flags. Recommend scheduling clinical follow-up within 1-2 weeks for joint examination and medication adjustment.",
                fallback_used=False,
                is_current="true",
                source="ENGINE",
                decision_trace={
                    "final_level": "Routine",
                    "risk_score": 46.0,
                    "votes": [
                        {"source": "GeriatricEngine.composer", "level": "Routine", "rationale": "Stable vitals and chronic symptom profile"}
                    ]
                },
                created_at=now - timedelta(hours=3),
            ))
            db.add(QualityScore(
                case_id=case_2.id,
                completeness_score=0.90,
                consistency_score=1.0,
                flags=[],
                requires_clarification=False,
                created_at=now - timedelta(hours=3),
            ))
            db.add(DifferentialDiagnosis(
                case_id=case_2.id,
                condition_name="Osteoarthritis Exacerbation",
                probability_score=0.78,
                evidence="Bilateral knee stiffness, morning joint pain lasting >30 mins, age 74, female.",
                created_at=now - timedelta(hours=3),
            ))
            db.add(DifferentialDiagnosis(
                case_id=case_2.id,
                condition_name="Tension-Type Headache",
                probability_score=0.20,
                evidence="Mild frontal non-pulsatile headache, absence of neurological deficit.",
                created_at=now - timedelta(hours=3),
            ))

            # Case 3: Self-Care Info (Mild Seasonal Throat Discomfort)
            case_3 = Case(
                patient_id=ramesh_profile.id,
                chief_complaint="Scratchy throat and mild nasal dryness after exposure to dusty wind, no fever or cough",
                status="submitted",
                is_emergency_flag=False,
                emergency_rule_fired=None,
                red_flag_retracted=False,
                ai_status="ready",
                assigned_clinician_id=doctor_user.id if doctor_user else None,
                created_at=now - timedelta(days=1),
            )
            db.add(case_3)
            db.flush()

            db.add(SymptomEntry(
                case_id=case_3.id,
                symptom="Mild scratchy throat",
                duration="1 day",
                severity=2,
                body_location="Throat / Neck",
            ))
            db.add(Vitals(
                case_id=case_3.id,
                temperature=98.2,
                pulse=72,
                blood_pressure="122/78",
                spo2=99.0,
            ))
            db.add(TriageResult(
                case_id=case_3.id,
                triage_level="Self-Care Info",
                risk_score=14.0,
                explanation="No acute red flags or systemic symptoms. Score 14/100 (Self-Care Info). Hydration, warm saline gargles, and monitoring advised.",
                fallback_used=False,
                is_current="true",
                source="ENGINE",
                decision_trace={
                    "final_level": "Self-Care Info",
                    "risk_score": 14.0,
                    "votes": [
                        {"source": "RedFlagEngine", "level": "Self-Care Info", "rationale": "Low risk, no flags"}
                    ]
                },
                created_at=now - timedelta(days=1),
            ))
            db.add(QualityScore(
                case_id=case_3.id,
                completeness_score=0.85,
                consistency_score=1.0,
                flags=[],
                requires_clarification=False,
                created_at=now - timedelta(days=1),
            ))
            db.add(DifferentialDiagnosis(
                case_id=case_3.id,
                condition_name="Mild Viral / Environmental Pharyngitis",
                probability_score=0.92,
                evidence="Scratchy throat following environmental exposure, no fever, stable vitals, normal SpO2.",
                created_at=now - timedelta(days=1),
            ))

            db.commit()
            print("Successfully populated 3 demonstration triage cases.")

        print("\nAll database seeding operations completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
