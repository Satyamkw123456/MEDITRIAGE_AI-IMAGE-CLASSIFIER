"""add skin_image_analyses (Triage Flow skin/wound image triage)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-10-26 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'skin_image_analyses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('case_id', sa.Integer(), sa.ForeignKey('cases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('image_data', sa.LargeBinary(), nullable=False),
        sa.Column('image_mime', sa.String(50), nullable=False),
        sa.Column('image_sha256', sa.String(64), nullable=False),
        sa.Column('image_width', sa.Integer(), nullable=True),
        sa.Column('image_height', sa.Integer(), nullable=True),
        sa.Column('body_part', sa.String(100), nullable=True),
        sa.Column('classifier_name', sa.String(100), nullable=False),
        sa.Column('classifier_available', sa.Boolean(), nullable=False),
        sa.Column('predictions', sa.JSON(), nullable=True),
        sa.Column('relevant_conditions', sa.JSON(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('severity_score', sa.Integer(), nullable=False),
        sa.Column('suggested_triage_level', sa.String(50), nullable=False),
        sa.Column('severity_reasons', sa.JSON(), nullable=True),
        sa.Column('rules_fired', sa.JSON(), nullable=True),
        sa.Column('confidence_band', sa.String(20), nullable=False),
        sa.Column('requires_clinician_review', sa.Boolean(), nullable=False),
        sa.Column('recommendation', sa.Text(), nullable=True),
        sa.Column('escalation_applied', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('trace', sa.JSON(), nullable=True),
        sa.Column('pipeline_version', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_skin_image_analyses_case_id', 'skin_image_analyses', ['case_id'])
    op.create_index('ix_skin_image_analyses_image_sha256', 'skin_image_analyses', ['image_sha256'])


def downgrade():
    op.drop_index('ix_skin_image_analyses_image_sha256', table_name='skin_image_analyses')
    op.drop_index('ix_skin_image_analyses_case_id', table_name='skin_image_analyses')
    op.drop_table('skin_image_analyses')
