"""Cycle 5 Chatbot & AI Hub Migration: ChatSession mode and ChatMessage safety metadata

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-09-30 11:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, None] = 'e3f4a5b6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add mode column to chat_sessions
    with op.batch_alter_table('chat_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('mode', sa.String(length=50), server_default='companion', nullable=False))

    # 2. Add safety and grounding metadata to chat_messages
    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('grounding_ids', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('safety_flags', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('amendment_proposal', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.drop_column('amendment_proposal')
        batch_op.drop_column('safety_flags')
        batch_op.drop_column('grounding_ids')

    with op.batch_alter_table('chat_sessions', schema=None) as batch_op:
        batch_op.drop_column('mode')
