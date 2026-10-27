import os
import sys
import unittest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from alembic import command
from alembic.config import Config

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app.models import Base, User, PatientProfile, Case, SymptomEntry, Vitals

TEST_DB_PATH = os.path.join(BASE_DIR, "test_meditriage.db")
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"


class TestDatabaseSchemaAndAlembic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 1. Ensure clean slate
        if os.path.exists(TEST_DB_PATH):
            try:
                os.remove(TEST_DB_PATH)
            except Exception:
                pass

        # 2. Run Alembic upgrade head
        cls.alembic_cfg = Config(os.path.join(BASE_DIR, "alembic.ini"))
        cls.alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
        cls.alembic_cfg.set_main_option("script_location", os.path.join(BASE_DIR, "alembic"))
        command.upgrade(cls.alembic_cfg, "head")

        # 3. Setup SQLAlchemy engine and session
        cls.engine = create_engine(TEST_DATABASE_URL)
        cls.Session = sessionmaker(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()
        if os.path.exists(TEST_DB_PATH):
            try:
                os.remove(TEST_DB_PATH)
            except Exception:
                pass

    def setUp(self):
        self.session = self.Session()

    def tearDown(self):
        self.session.close()

    def test_01_tables_and_columns_exist(self):
        """Verify all 5 Tier-1 core tables and only those exist in the database."""
        inspector = inspect(self.engine)
        tables = set(inspector.get_table_names())

        expected_tables = {
            "users", "patient_profiles", "cases", "symptom_entries", "vitals",
            "consent_logs", "triage_results", "quality_scores",
            "differential_diagnoses", "ai_audit_logs", "clinician_feedback", "alembic_version",
            "case_revisions", "chat_sessions", "chat_messages", "permissions", "roles",
            "role_permissions", "user_permission_grants", "admin_actions", "config_versions",
            "patient_baselines", "daily_checkins", "medications", "drug_brand_map",
            "drug_rules", "geriatric_screens", "caregiver_links", "emergency_cards",
            "consents", "data_rights_requests", "job_runs", "prompt_registry",
            "case_comments", "announcements", "impersonation_sessions",
            "break_glass_reveals", "emergency_resources", "access_history_logs",
            "security_incidents", "refresh_tokens", "skin_image_analyses"
        }
        self.assertEqual(tables, expected_tables, f"Tables mismatch: found {tables}, expected {expected_tables}")

        # Check differential_diagnoses table columns
        diag_cols = {c["name"] for c in inspector.get_columns("differential_diagnoses")}
        self.assertTrue({"id", "case_id", "condition_name", "probability_score", "evidence", "created_at"}.issubset(diag_cols))

        # Check ai_audit_logs table columns
        audit_cols = {c["name"] for c in inspector.get_columns("ai_audit_logs")}
        self.assertTrue({"id", "case_id", "model_name", "prompt_version", "raw_prompt", "raw_response", "output_summary", "created_at"}.issubset(audit_cols))

        # Check quality_scores table columns
        quality_cols = {c["name"] for c in inspector.get_columns("quality_scores")}
        self.assertTrue({"id", "case_id", "completeness_score", "consistency_score", "flags", "requires_clarification", "clarifying_question", "created_at"}.issubset(quality_cols))

        # Check triage_results table columns
        triage_cols = {c["name"] for c in inspector.get_columns("triage_results")}
        self.assertTrue({"id", "case_id", "triage_level", "risk_score", "explanation", "created_at"}.issubset(triage_cols))

        # Check consent_logs table columns
        consent_cols = {c["name"] for c in inspector.get_columns("consent_logs")}
        self.assertTrue({"id", "user_id", "consent_type", "version", "granted", "granted_by", "caregiver_name", "caregiver_relationship", "ip_address", "created_at"}.issubset(consent_cols))

        # Check users table columns
        user_cols = {c["name"] for c in inspector.get_columns("users")}
        self.assertTrue({"id", "name", "email", "password_hash", "role"}.issubset(user_cols))

        # Check patient_profiles table columns
        pp_cols = {c["name"] for c in inspector.get_columns("patient_profiles")}
        self.assertTrue({"id", "user_id", "age", "sex", "medical_history", "allergies"}.issubset(pp_cols))

        # Check cases table columns
        case_cols = {c["name"] for c in inspector.get_columns("cases")}
        self.assertTrue({"id", "patient_id", "chief_complaint", "status", "created_at"}.issubset(case_cols))

        # Check symptom_entries table columns
        symptom_cols = {c["name"] for c in inspector.get_columns("symptom_entries")}
        self.assertTrue({"id", "case_id", "symptom", "duration", "severity", "body_location"}.issubset(symptom_cols))

        # Check vitals table columns
        vital_cols = {c["name"] for c in inspector.get_columns("vitals")}
        self.assertTrue({"id", "case_id", "temperature", "pulse", "blood_pressure", "spo2"}.issubset(vital_cols))

    def test_02_foreign_key_references(self):
        """Confirm all foreign keys reference existing tables and columns correctly."""
        inspector = inspect(self.engine)

        # patient_profiles -> users.id
        pp_fks = inspector.get_foreign_keys("patient_profiles")
        self.assertTrue(
            any(fk["referred_table"] == "users" and fk["referred_columns"] == ["id"] for fk in pp_fks),
            "patient_profiles FK to users.id missing"
        )

        # cases -> patient_profiles.id
        case_fks = inspector.get_foreign_keys("cases")
        self.assertTrue(
            any(fk["referred_table"] == "patient_profiles" and fk["referred_columns"] == ["id"] for fk in case_fks),
            "cases FK to patient_profiles.id missing"
        )

        # symptom_entries -> cases.id
        sym_fks = inspector.get_foreign_keys("symptom_entries")
        self.assertTrue(
            any(fk["referred_table"] == "cases" and fk["referred_columns"] == ["id"] for fk in sym_fks),
            "symptom_entries FK to cases.id missing"
        )

        # vitals -> cases.id
        vit_fks = inspector.get_foreign_keys("vitals")
        self.assertTrue(
            any(fk["referred_table"] == "cases" and fk["referred_columns"] == ["id"] for fk in vit_fks),
            "vitals FK to cases.id missing"
        )

        # quality_scores -> cases.id
        qs_fks = inspector.get_foreign_keys("quality_scores")
        self.assertTrue(
            any(fk["referred_table"] == "cases" and fk["referred_columns"] == ["id"] for fk in qs_fks),
            "quality_scores FK to cases.id missing"
        )

        # differential_diagnoses -> cases.id
        diag_fks = inspector.get_foreign_keys("differential_diagnoses")
        self.assertTrue(
            any(fk["referred_table"] == "cases" and fk["referred_columns"] == ["id"] for fk in diag_fks),
            "differential_diagnoses FK to cases.id missing"
        )

        # ai_audit_logs -> cases.id
        audit_fks = inspector.get_foreign_keys("ai_audit_logs")
        self.assertTrue(
            any(fk["referred_table"] == "cases" and fk["referred_columns"] == ["id"] for fk in audit_fks),
            "ai_audit_logs FK to cases.id missing"
        )

    def test_03_end_to_end_data_insert_and_relationships(self):
        """Insert records across all 5 tables and test relational traversal."""
        # 1. User
        user = User(
            name="Ramesh Sharma",
            email="ramesh.sharma@example.com",
            password_hash="argon2_or_bcrypt_hash_placeholder",
            role="patient"
        )
        self.session.add(user)
        self.session.commit()
        self.assertIsNotNone(user.id)

        # 2. PatientProfile
        profile = PatientProfile(
            user_id=user.id,
            age=74,
            sex="Male",
            medical_history="Type 2 Diabetes, Hypertension (on Atenolol)",
            allergies="Penicillin"
        )
        self.session.add(profile)
        self.session.commit()
        self.assertIsNotNone(profile.id)

        # 3. Case
        case = Case(
            patient_id=profile.id,
            chief_complaint="Sudden dizziness, acute confusion, mild breathlessness",
            status="submitted"
        )
        self.session.add(case)
        self.session.commit()
        self.assertIsNotNone(case.id)

        # 4. Symptoms
        s1 = SymptomEntry(
            case_id=case.id,
            symptom="Acute confusion",
            duration="4 hours",
            severity=8,
            body_location="Head / Cognitive"
        )
        s2 = SymptomEntry(
            case_id=case.id,
            symptom="Shortness of breath",
            duration="1 day",
            severity=6,
            body_location="Chest"
        )
        self.session.add_all([s1, s2])
        self.session.commit()

        # 5. Vitals
        vitals = Vitals(
            case_id=case.id,
            temperature=98.6,
            pulse=64, # Note: Blunted by beta-blocker
            blood_pressure="105/65",
            spo2=93.0
        )
        self.session.add(vitals)
        self.session.commit()

        # Query and verify
        fetched_case = self.session.query(Case).filter_by(id=case.id).first()
        self.assertIsNotNone(fetched_case)
        self.assertEqual(fetched_case.patient.user.name, "Ramesh Sharma")
        self.assertEqual(fetched_case.patient.age, 74)
        self.assertEqual(len(fetched_case.symptoms), 2)
        self.assertEqual(len(fetched_case.vitals), 1)
        self.assertEqual(fetched_case.vitals[0].spo2, 93.0)
        self.assertEqual(fetched_case.vitals[0].pulse, 64)


if __name__ == "__main__":
    unittest.main(verbosity=2)
