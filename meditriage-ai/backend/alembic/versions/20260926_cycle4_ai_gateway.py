"""Cycle 4 AI Gateway Migration: AIAuditLog enhancements and PromptRegistry columns

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-09-29 23:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add fields to ai_audit_logs
    with op.batch_alter_table('ai_audit_logs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tokens_in', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('tokens_out', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('latency_ms', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('scrub_report', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('block_reason', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('fallback_used', sa.Boolean(), server_default='0', nullable=False))

    # 2. Add columns to prompt_registry
    with op.batch_alter_table('prompt_registry', schema=None) as batch_op:
        batch_op.add_column(sa.Column('prompt_code', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('version', sa.Integer(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('template_hash', sa.String(length=64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('prompt_registry', schema=None) as batch_op:
        batch_op.drop_column('template_hash')
        batch_op.drop_column('version')
        batch_op.drop_column('prompt_code')

    with op.batch_alter_table('ai_audit_logs', schema=None) as batch_op:
        batch_op.drop_column('fallback_used')
        batch_op.drop_column('block_reason')
        batch_op.drop_column('scrub_report')
        batch_op.drop_column('latency_ms')
        batch_op.drop_column('tokens_out')
        batch_op.drop_column('tokens_in')
