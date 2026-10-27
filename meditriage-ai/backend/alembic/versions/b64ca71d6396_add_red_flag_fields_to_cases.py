"""add_red_flag_fields_to_cases

Revision ID: b64ca71d6396
Revises: f460c5e6e7b5
Create Date: 2026-08-06 18:31:51.398589

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b64ca71d6396'
down_revision: Union[str, None] = 'f460c5e6e7b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('cases', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_emergency_flag', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        batch_op.add_column(sa.Column('emergency_rule_fired', sa.String(length=500), nullable=True))
        batch_op.create_index(batch_op.f('ix_cases_is_emergency_flag'), ['is_emergency_flag'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('cases', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_cases_is_emergency_flag'))
        batch_op.drop_column('emergency_rule_fired')
        batch_op.drop_column('is_emergency_flag')
