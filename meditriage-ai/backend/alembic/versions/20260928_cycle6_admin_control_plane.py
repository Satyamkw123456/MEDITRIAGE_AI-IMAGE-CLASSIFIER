"""Cycle 6: Admin Control Plane schema additions

Revision ID: a1b2c3d4e5f6
Revises: f4a5b6c7d8e9
Create Date: 2026-09-28 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f4a5b6c7d8e9'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Extend users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_suspended', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('token_version', sa.Integer(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('clinician_verification_status', sa.String(length=50), server_default='unverified', nullable=False))
        batch_op.add_column(sa.Column('clinician_registration_number', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('clinician_credential_doc', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('requires_reconsent', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('failed_login_attempts', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))

    # 2. Extend cases table
    with op.batch_alter_table('cases', schema=None) as batch_op:
        batch_op.add_column(sa.Column('legal_hold', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('legal_hold_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('assigned_clinician_id', sa.Integer(), sa.ForeignKey('users.id', name='fk_cases_assigned_clinician_id', ondelete='SET NULL'), nullable=True))
        batch_op.add_column(sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('is_archived', sa.Boolean(), server_default='0', nullable=False))

    # 3. Extend data_rights_requests table
    with op.batch_alter_table('data_rights_requests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('request_type', sa.String(length=50), server_default='ACCESS', nullable=False))
        batch_op.add_column(sa.Column('status', sa.String(length=50), server_default='PENDING', nullable=False))
        batch_op.add_column(sa.Column('due_date', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('verified_by', sa.Integer(), sa.ForeignKey('users.id', name='fk_drr_verified_by', ondelete='SET NULL'), nullable=True))
        batch_op.add_column(sa.Column('closed_note', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('legal_hold', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('legal_hold_reason', sa.Text(), nullable=True))

    # 4. Create announcements table
    op.create_table(
        'announcements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('audience', sa.String(length=50), server_default='all', nullable=False),
        sa.Column('banner_type', sa.String(length=50), server_default='info', nullable=False),
        sa.Column('effective_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_announcements_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_announcements_audience'), ['audience'], unique=False)
        batch_op.create_index(batch_op.f('ix_announcements_is_active'), ['is_active'], unique=False)


def downgrade():
    op.drop_table('announcements')

    with op.batch_alter_table('data_rights_requests', schema=None) as batch_op:
        batch_op.drop_column('legal_hold_reason')
        batch_op.drop_column('legal_hold')
        batch_op.drop_column('closed_note')
        batch_op.drop_column('verified_by')
        batch_op.drop_column('due_date')

    with op.batch_alter_table('cases', schema=None) as batch_op:
        batch_op.drop_column('is_archived')
        batch_op.drop_column('acknowledged_at')
        batch_op.drop_column('assigned_clinician_id')
        batch_op.drop_column('legal_hold_reason')
        batch_op.drop_column('legal_hold')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('locked_until')
        batch_op.drop_column('failed_login_attempts')
        batch_op.drop_column('requires_reconsent')
        batch_op.drop_column('clinician_credential_doc')
        batch_op.drop_column('clinician_registration_number')
        batch_op.drop_column('clinician_verification_status')
        batch_op.drop_column('token_version')
        batch_op.drop_column('is_suspended')
