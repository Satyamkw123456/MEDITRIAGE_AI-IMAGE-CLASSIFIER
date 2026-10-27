"""add_decision_trace_to_triage_results

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-11 05:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('triage_results', sa.Column('decision_trace', sa.JSON(), nullable=True))
    op.add_column('cases', sa.Column('ai_status', sa.String(length=50), nullable=True))


def downgrade():
    op.drop_column('cases', 'ai_status')
    op.drop_column('triage_results', 'decision_trace')
