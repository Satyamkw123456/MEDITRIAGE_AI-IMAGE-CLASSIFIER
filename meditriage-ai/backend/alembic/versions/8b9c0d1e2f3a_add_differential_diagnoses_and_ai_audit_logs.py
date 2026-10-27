"""add_differential_diagnoses_and_ai_audit_logs

Revision ID: 8b9c0d1e2f3a
Revises: 7a8b9c0d1e2f
Create Date: 2026-08-08 21:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b9c0d1e2f3a'
down_revision: Union[str, None] = '7a8b9c0d1e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. differential_diagnoses
    op.create_table(
        'differential_diagnoses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('condition_name', sa.String(length=255), nullable=False),
        sa.Column('probability_score', sa.Float(), nullable=False),
        sa.Column('evidence', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('differential_diagnoses', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_differential_diagnoses_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_differential_diagnoses_case_id'), ['case_id'], unique=False)

    # 2. ai_audit_logs
    op.create_table(
        'ai_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('prompt_version', sa.String(length=50), nullable=False),
        sa.Column('raw_prompt', sa.Text(), nullable=False),
        sa.Column('raw_response', sa.Text(), nullable=False),
        sa.Column('output_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('ai_audit_logs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ai_audit_logs_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_ai_audit_logs_case_id'), ['case_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('ai_audit_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ai_audit_logs_case_id'))
        batch_op.drop_index(batch_op.f('ix_ai_audit_logs_id'))
    op.drop_table('ai_audit_logs')

    with op.batch_alter_table('differential_diagnoses', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_differential_diagnoses_case_id'))
        batch_op.drop_index(batch_op.f('ix_differential_diagnoses_id'))
    op.drop_table('differential_diagnoses')
