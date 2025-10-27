"""Create reconciliation tables

Revision ID: 002
Revises: 001
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # Create zomato_vs_pos_summary table
    op.create_table('zomato_vs_pos_summary',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('pos_order_id', sa.String(255), nullable=True),
        sa.Column('zomato_order_id', sa.String(255), nullable=True),
        sa.Column('order_date', sa.Date(), nullable=True),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('pos_net_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_net_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_net_amount_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('reconciled_status', sa.String(255), nullable=True),
        sa.Column('reconciled_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('unreconciled_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create threepo_dashboard table
    op.create_table('threepo_dashboard',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('bank', sa.String(255), nullable=True),
        sa.Column('business_date', sa.Date(), nullable=True),
        sa.Column('store_code', sa.String(255), nullable=True),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('city', sa.String(255), nullable=True),
        sa.Column('zone', sa.String(255), nullable=True),
        sa.Column('total_orders', sa.Numeric(15, 2), nullable=True),
        sa.Column('total_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('net_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('commission', sa.Numeric(15, 2), nullable=True),
        sa.Column('pg_charges', sa.Numeric(15, 2), nullable=True),
        sa.Column('tds_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('final_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create store table
    op.create_table('store',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('store_code', sa.String(255), nullable=True),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('city', sa.String(255), nullable=True),
        sa.Column('zone', sa.String(255), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('contact_number', sa.String(255), nullable=True),
        sa.Column('store_type', sa.String(255), nullable=True),
        sa.Column('eotf_status', sa.String(255), nullable=True),
        sa.Column('created_date', sa.String(255), nullable=True),
        sa.Column('updated_date', sa.String(255), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create trm table
    op.create_table('trm',
        sa.Column('uid', sa.String(255), nullable=False),
        sa.Column('zone', sa.String(128), nullable=True),
        sa.Column('store_name', sa.String(128), nullable=True),
        sa.Column('city', sa.String(128), nullable=True),
        sa.Column('pos', sa.String(128), nullable=True),
        sa.Column('hardware_model', sa.String(128), nullable=True),
        sa.Column('hardware_id', sa.String(128), nullable=True),
        sa.Column('acquirer', sa.String(128), nullable=True),
        sa.Column('tid', sa.String(128), nullable=True),
        sa.Column('mid', sa.String(128), nullable=True),
        sa.Column('batch_no', sa.String(128), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=True),
        sa.Column('transaction_time', sa.String(128), nullable=True),
        sa.Column('card_number', sa.String(128), nullable=True),
        sa.Column('transaction_type', sa.String(128), nullable=True),
        sa.Column('amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('currency', sa.String(128), nullable=True),
        sa.Column('auth_code', sa.String(128), nullable=True),
        sa.Column('rrn', sa.String(128), nullable=True),
        sa.Column('status', sa.String(128), nullable=True),
        sa.PrimaryKeyConstraint('uid'),
        sa.UniqueConstraint('uid')
    )


def downgrade():
    op.drop_table('trm')
    op.drop_table('store')
    op.drop_table('threepo_dashboard')
    op.drop_table('zomato_vs_pos_summary')
