"""fix substrate tables missing columns

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-10-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b8c9d0e1f2a3'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('job_runs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('job_name', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('status', sa.String(length=50), server_default='RUNNING', nullable=True))
        batch_op.create_index('ix_job_runs_job_name', ['job_name'])

    with op.batch_alter_table('medications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('deleted_by', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('purge_after', sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table('drug_brand_map', schema=None) as batch_op:
        batch_op.add_column(sa.Column('brand_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('generic_name', sa.String(length=255), nullable=True))
        batch_op.create_index('ix_drug_brand_map_brand_name', ['brand_name'])
        batch_op.create_index('ix_drug_brand_map_generic_name', ['generic_name'])

    with op.batch_alter_table('drug_rules', schema=None) as batch_op:
        batch_op.add_column(sa.Column('rule_code', sa.String(length=100), nullable=True))
        batch_op.create_index('ix_drug_rules_rule_code', ['rule_code'])

    with op.batch_alter_table('caregiver_links', schema=None) as batch_op:
        batch_op.add_column(sa.Column('patient_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('caregiver_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_caregiver_links_patient_id', ['patient_id'])
        batch_op.create_index('ix_caregiver_links_caregiver_id', ['caregiver_id'])


def downgrade():
    with op.batch_alter_table('caregiver_links', schema=None) as batch_op:
        batch_op.drop_index('ix_caregiver_links_caregiver_id')
        batch_op.drop_index('ix_caregiver_links_patient_id')
        batch_op.drop_column('caregiver_id')
        batch_op.drop_column('patient_id')

    with op.batch_alter_table('drug_rules', schema=None) as batch_op:
        batch_op.drop_index('ix_drug_rules_rule_code')
        batch_op.drop_column('rule_code')

    with op.batch_alter_table('drug_brand_map', schema=None) as batch_op:
        batch_op.drop_index('ix_drug_brand_map_generic_name')
        batch_op.drop_index('ix_drug_brand_map_brand_name')
        batch_op.drop_column('generic_name')
        batch_op.drop_column('brand_name')

    with op.batch_alter_table('medications', schema=None) as batch_op:
        batch_op.drop_column('purge_after')
        batch_op.drop_column('deleted_by')
        batch_op.drop_column('deleted_at')

    with op.batch_alter_table('job_runs', schema=None) as batch_op:
        batch_op.drop_index('ix_job_runs_job_name')
        batch_op.drop_column('status')
        batch_op.drop_column('job_name')
