"""Cycle 7: Admin Control Plane Part B schema additions

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-29 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Impersonation Sessions
    op.create_table(
        'impersonation_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('admin_id', sa.Integer(), nullable=False),
        sa.Column('target_user_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('ticket_ref', sa.String(length=100), nullable=False),
        sa.Column('token', sa.String(length=500), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], name='fk_impersonation_admin_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], name='fk_impersonation_target_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_impersonation_sessions_id'), 'impersonation_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_impersonation_sessions_admin_id'), 'impersonation_sessions', ['admin_id'], unique=False)
    op.create_index(op.f('ix_impersonation_sessions_target_user_id'), 'impersonation_sessions', ['target_user_id'], unique=False)

    # 2. Break Glass Reveals
    op.create_table(
        'break_glass_reveals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_break_glass_user_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], name='fk_break_glass_case_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_break_glass_reveals_id'), 'break_glass_reveals', ['id'], unique=False)
    op.create_index(op.f('ix_break_glass_reveals_user_id'), 'break_glass_reveals', ['user_id'], unique=False)
    op.create_index(op.f('ix_break_glass_reveals_case_id'), 'break_glass_reveals', ['case_id'], unique=False)

    # 3. Emergency Resources
    op.create_table(
        'emergency_resources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('phone_number', sa.String(length=50), nullable=False),
        sa.Column('city_region', sa.String(length=100), nullable=False),
        sa.Column('last_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_emergency_resources_id'), 'emergency_resources', ['id'], unique=False)

    # 4. Access History Logs
    op.create_table(
        'access_history_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=True),
        sa.Column('patient_id', sa.Integer(), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=False),
        sa.Column('actor_name', sa.String(length=255), nullable=True),
        sa.Column('actor_role', sa.String(length=50), nullable=True),
        sa.Column('access_type', sa.String(length=50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('ticket_ref', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], name='fk_access_logs_case_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['users.id'], name='fk_access_logs_patient_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], name='fk_access_logs_actor_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_access_history_logs_id'), 'access_history_logs', ['id'], unique=False)
    op.create_index(op.f('ix_access_history_logs_case_id'), 'access_history_logs', ['case_id'], unique=False)
    op.create_index(op.f('ix_access_history_logs_patient_id'), 'access_history_logs', ['patient_id'], unique=False)
    op.create_index(op.f('ix_access_history_logs_actor_id'), 'access_history_logs', ['actor_id'], unique=False)

    # 5. Security Incidents
    op.create_table(
        'security_incidents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('incident_code', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('affected_accounts_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('reported_by', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='OPEN', nullable=False),
        sa.Column('remediation_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['reported_by'], ['users.id'], name='fk_security_incidents_reporter', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_security_incidents_id'), 'security_incidents', ['id'], unique=False)
    op.create_index(op.f('ix_security_incidents_incident_code'), 'security_incidents', ['incident_code'], unique=True)


def downgrade():
    op.drop_table('security_incidents')
    op.drop_table('access_history_logs')
    op.drop_table('emergency_resources')
    op.drop_table('break_glass_reveals')
    op.drop_table('impersonation_sessions')
