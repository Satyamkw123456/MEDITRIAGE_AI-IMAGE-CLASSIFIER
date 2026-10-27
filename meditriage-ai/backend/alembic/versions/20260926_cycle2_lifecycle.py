"""Cycle 2 Lifecycle Migration: CaseComments table and red_flag_retracted column

Revision ID: d2e3f4a5b6c7
Revises: c1a2b3c4d5e6
Create Date: 2026-09-26 11:46:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, None] = 'c1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add red_flag_retracted to cases
    with op.batch_alter_table('cases', schema=None) as batch_op:
        batch_op.add_column(sa.Column('red_flag_retracted', sa.Boolean(), server_default='0', nullable=False))

    # 2. Create case_comments table
    op.create_table(
        'case_comments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('author_role', sa.String(length=50), nullable=False),
        sa.Column('comment_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_case_comments_case_id'), 'case_comments', ['case_id'], unique=False)
    op.create_index(op.f('ix_case_comments_id'), 'case_comments', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_case_comments_id'), table_name='case_comments')
    op.drop_index(op.f('ix_case_comments_case_id'), table_name='case_comments')
    op.drop_table('case_comments')

    with op.batch_alter_table('cases', schema=None) as batch_op:
        batch_op.drop_column('red_flag_retracted')
