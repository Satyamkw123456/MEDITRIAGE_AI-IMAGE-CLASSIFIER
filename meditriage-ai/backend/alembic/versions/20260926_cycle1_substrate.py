"""Cycle 1 Substrate Migration: CaseRevisions, TriageResult versioning, Soft-Deletes, RBAC, AdminActions, GovernedConfig, and Substrate Tables

Revision ID: c1a2b3c4d5e6
Revises: 1932bc1ab7f5
Create Date: 2026-09-26 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3c4d5e6'
down_revision: Union[str, None] = '1932bc1ab7f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update users table with MFA columns
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('mfa_secret', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('mfa_enabled', sa.String(length=10), server_default='false', nullable=False))

    # 2. Update patient_profiles table with is_synthetic
    with op.batch_alter_table('patient_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_synthetic', sa.String(length=10), server_default='true', nullable=False))

    # Backfill is_synthetic = 'true' for all existing profiles
    op.execute("UPDATE patient_profiles SET is_synthetic = 'true' WHERE is_synthetic IS NULL OR is_synthetic = ''")

    # 3. Update triage_results with versioning columns
    with op.batch_alter_table('triage_results', schema=None) as batch_op:
        batch_op.add_column(sa.Column('version', sa.Integer(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('is_current', sa.String(length=10), server_default='true', nullable=False))
        batch_op.add_column(sa.Column('source', sa.String(length=50), server_default='ENGINE', nullable=False))
        batch_op.add_column(sa.Column('supersedes_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_triage_results_is_current', ['is_current'], unique=False)

    # Backfill is_current = 'true' for all existing triage_results
    op.execute("UPDATE triage_results SET is_current = 'true', version = 1, source = 'ENGINE' WHERE is_current IS NULL OR is_current = ''")

    # 4. Soft delete columns on cases, symptom_entries, vitals
    with op.batch_alter_table('cases', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('deleted_by', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('purge_after', sa.DateTime(timezone=True), nullable=True))

    # 5. Create case_revisions table
    op.create_table(
        'case_revisions',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('case_id', sa.Integer(), sa.ForeignKey('cases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('revision_no', sa.Integer(), nullable=False),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('actor_role', sa.String(length=50), nullable=False),
        sa.Column('change_type', sa.String(length=50), nullable=False),
        sa.Column('field_path', sa.String(length=255), nullable=True),
        sa.Column('before_state', sa.JSON(), nullable=True),
        sa.Column('after_state', sa.JSON(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('case_id', 'revision_no', name='uq_case_revision_no')
    )
    op.create_index('ix_case_revisions_case_id', 'case_revisions', ['case_id'])

    # 6. Create chat_sessions & chat_messages tables
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('case_id', sa.Integer(), sa.ForeignKey('cases.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='active', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.Integer(), nullable=True),
        sa.Column('purge_after', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_index('ix_chat_sessions_user_id', 'chat_sessions', ['user_id'])

    op.create_table(
        'chat_messages',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_role', sa.String(length=50), nullable=False),
        sa.Column('message_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 7. Create RBAC tables (permissions, roles, role_permissions, user_permission_grants)
    op.create_table(
        'permissions',
        sa.Column('code', sa.String(length=100), nullable=False, primary_key=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_sensitive', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('requires_stepup', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('requires_dual_control', sa.Boolean(), server_default='false', nullable=False)
    )

    op.create_table(
        'roles',
        sa.Column('code', sa.String(length=50), nullable=False, primary_key=True),
        sa.Column('description', sa.Text(), nullable=True)
    )

    op.create_table(
        'role_permissions',
        sa.Column('role_code', sa.String(length=50), sa.ForeignKey('roles.code', ondelete='CASCADE'), nullable=False),
        sa.Column('permission_code', sa.String(length=100), sa.ForeignKey('permissions.code', ondelete='CASCADE'), nullable=False),
        sa.PrimaryKeyConstraint('role_code', 'permission_code')
    )

    op.create_table(
        'user_permission_grants',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission_code', sa.String(length=100), sa.ForeignKey('permissions.code', ondelete='CASCADE'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('granted_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 8. Create admin_actions table (Tamper-evident audit log)
    op.create_table(
        'admin_actions',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('action_code', sa.String(length=100), nullable=False),
        sa.Column('target_type', sa.String(length=100), nullable=False),
        sa.Column('target_id', sa.String(length=100), nullable=False),
        sa.Column('before_state', sa.JSON(), nullable=True),
        sa.Column('after_state', sa.JSON(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('ticket_ref', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='APPLIED', nullable=False),
        sa.Column('approver_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('idempotency_key', sa.String(length=100), nullable=True),
        sa.Column('request_id', sa.String(length=100), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('prev_hash', sa.String(length=64), nullable=True),
        sa.Column('entry_hash', sa.String(length=64), nullable=True),
        sa.Column('self_approved_demo', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_index('ix_admin_actions_action_code', 'admin_actions', ['action_code'])
    op.create_index('ix_admin_actions_actor_id', 'admin_actions', ['actor_id'])

    # 9. Create config_versions table (Governed config)
    op.create_table(
        'config_versions',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('namespace', sa.String(length=100), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='draft', nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('checksum', sa.String(length=64), nullable=False),
        sa.Column('parent_version', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('published_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_index('ix_config_versions_namespace', 'config_versions', ['namespace'])
    op.create_index('ix_config_versions_key', 'config_versions', ['key'])

    # 10. Substrate tables (patient_baselines, daily_checkins, medications, etc.)
    substrate_tables = [
        'patient_baselines', 'daily_checkins', 'medications', 'drug_brand_map',
        'drug_rules', 'geriatric_screens', 'caregiver_links', 'emergency_cards',
        'consents', 'data_rights_requests', 'job_runs', 'prompt_registry'
    ]
    for tbl in substrate_tables:
        op.create_table(
            tbl,
            sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('payload', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
        )


def downgrade() -> None:
    substrate_tables = [
        'prompt_registry', 'job_runs', 'data_rights_requests', 'consents',
        'emergency_cards', 'caregiver_links', 'geriatric_screens', 'drug_rules',
        'drug_brand_map', 'medications', 'daily_checkins', 'patient_baselines'
    ]
    for tbl in substrate_tables:
        op.drop_table(tbl)

    op.drop_table('config_versions')
    op.drop_table('admin_actions')
    op.drop_table('user_permission_grants')
    op.drop_table('role_permissions')
    op.drop_table('roles')
    op.drop_table('permissions')
    op.drop_table('chat_messages')
    op.drop_table('chat_sessions')
    op.drop_table('case_revisions')

    with op.batch_alter_table('cases', schema=None) as batch_op:
        batch_op.drop_column('purge_after')
        batch_op.drop_column('deleted_by')
        batch_op.drop_column('deleted_at')

    with op.batch_alter_table('triage_results', schema=None) as batch_op:
        batch_op.drop_index('ix_triage_results_is_current')
        batch_op.drop_column('supersedes_id')
        batch_op.drop_column('source')
        batch_op.drop_column('is_current')
        batch_op.drop_column('version')

    with op.batch_alter_table('patient_profiles', schema=None) as batch_op:
        batch_op.drop_column('is_synthetic')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('mfa_enabled')
        batch_op.drop_column('mfa_secret')
