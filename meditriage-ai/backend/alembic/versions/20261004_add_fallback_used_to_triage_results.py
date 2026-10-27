"""add_fallback_used_to_triage_results

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-04 11:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('triage_results', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('fallback_used', sa.Boolean(), server_default=sa.text('false'), nullable=False)
        )
    # Backfill existing rows to false
    op.execute("UPDATE triage_results SET fallback_used = false WHERE fallback_used IS NULL")


def downgrade():
    with op.batch_alter_table('triage_results', schema=None) as batch_op:
        batch_op.drop_column('fallback_used')
