"""fix_triage_results_unique_index

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-01 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('triage_results', schema=None) as batch_op:
        batch_op.drop_index('ix_triage_results_case_id')
        batch_op.create_index('ix_triage_results_case_id', ['case_id'], unique=False)


def downgrade():
    with op.batch_alter_table('triage_results', schema=None) as batch_op:
        batch_op.drop_index('ix_triage_results_case_id')
        batch_op.create_index('ix_triage_results_case_id', ['case_id'], unique=True)
