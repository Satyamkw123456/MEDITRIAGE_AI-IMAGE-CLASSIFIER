"""add_follow_up_questions_to_quality_scores

Revision ID: 7a8b9c0d1e2f
Revises: 52c9cdb6df19
Create Date: 2026-08-08 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, None] = '52c9cdb6df19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('quality_scores', schema=None) as batch_op:
        batch_op.add_column(sa.Column('follow_up_questions', sa.JSON(), nullable=False, server_default=sa.text("'[]'")))


def downgrade() -> None:
    with op.batch_alter_table('quality_scores', schema=None) as batch_op:
        batch_op.drop_column('follow_up_questions')
