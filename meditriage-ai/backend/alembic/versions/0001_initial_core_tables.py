"""0001_initial_core_tables

Revision ID: 0001_initial_core_tables
Revises: 
Create Date: 2026-08-05 11:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_initial_core_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='patient'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. patient_profiles table
    op.create_table(
        'patient_profiles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('sex', sa.String(length=50), nullable=True),
        sa.Column('medical_history', sa.Text(), nullable=True),
        sa.Column('allergies', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_patient_profiles_id'), 'patient_profiles', ['id'], unique=False)

    # 3. cases table
    op.create_table(
        'cases',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('patient_id', sa.Integer(), nullable=False),
        sa.Column('chief_complaint', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='submitted'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['patient_id'], ['patient_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_cases_id'), 'cases', ['id'], unique=False)
    op.create_index(op.f('ix_cases_patient_id'), 'cases', ['patient_id'], unique=False)

    # 4. symptom_entries table
    op.create_table(
        'symptom_entries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('symptom', sa.String(length=255), nullable=False),
        sa.Column('duration', sa.String(length=100), nullable=True),
        sa.Column('severity', sa.Integer(), nullable=True),
        sa.Column('body_location', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_symptom_entries_id'), 'symptom_entries', ['id'], unique=False)
    op.create_index(op.f('ix_symptom_entries_case_id'), 'symptom_entries', ['case_id'], unique=False)

    # 5. vitals table
    op.create_table(
        'vitals',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('temperature', sa.Float(), nullable=True),
        sa.Column('pulse', sa.Integer(), nullable=True),
        sa.Column('blood_pressure', sa.String(length=50), nullable=True),
        sa.Column('spo2', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vitals_id'), 'vitals', ['id'], unique=False)
    op.create_index(op.f('ix_vitals_case_id'), 'vitals', ['case_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vitals_case_id'), table_name='vitals')
    op.drop_index(op.f('ix_vitals_id'), table_name='vitals')
    op.drop_table('vitals')

    op.drop_index(op.f('ix_symptom_entries_case_id'), table_name='symptom_entries')
    op.drop_index(op.f('ix_symptom_entries_id'), table_name='symptom_entries')
    op.drop_table('symptom_entries')

    op.drop_index(op.f('ix_cases_patient_id'), table_name='cases')
    op.drop_index(op.f('ix_cases_id'), table_name='cases')
    op.drop_table('cases')

    op.drop_index(op.f('ix_patient_profiles_id'), table_name='patient_profiles')
    op.drop_table('patient_profiles')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
