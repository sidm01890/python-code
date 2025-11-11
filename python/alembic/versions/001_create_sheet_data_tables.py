"""Create sheet data tables

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create zomato_pos_vs_3po_data table
    op.create_table('zomato_pos_vs_3po_data',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('pos_order_id', sa.String(255), nullable=True),
        sa.Column('zomato_order_id', sa.String(255), nullable=True),
        sa.Column('order_date', sa.Date(), nullable=True),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('pos_net_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_net_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_net_amount_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_tax_paid_by_customer', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_tax_paid_by_customer', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_tax_paid_by_customer_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_commission_value', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_commission_value', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_commission_value_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_pg_applied_on', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_pg_applied_on', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_pg_applied_on_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_pg_charge', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_pg_charge', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_pg_charge_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_taxes_zomato_fee', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_taxes_zomato_fee', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_taxes_zomato_fee_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_tds_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_tds_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_tds_amount_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_final_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_final_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_final_amount_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('reconciled_status', sa.String(255), nullable=True),
        sa.Column('reconciled_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('unreconciled_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_vs_zomato_reason', sa.String(255), nullable=True),
        sa.Column('order_status_pos', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create zomato_3po_vs_pos_data table
    op.create_table('zomato_3po_vs_pos_data',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('zomato_order_id', sa.String(255), nullable=True),
        sa.Column('pos_order_id', sa.String(255), nullable=True),
        sa.Column('order_date', sa.Date(), nullable=True),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('zomato_net_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('pos_net_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('zomato_vs_pos_net_amount_delta', sa.Numeric(15, 2), nullable=True),
        sa.Column('reconciled_status', sa.String(255), nullable=True),
        sa.Column('reconciled_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('unreconciled_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create zomato_3po_vs_pos_refund_data table
    op.create_table('zomato_3po_vs_pos_refund_data',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('zomato_order_id', sa.String(255), nullable=True),
        sa.Column('pos_order_id', sa.String(255), nullable=True),
        sa.Column('order_date', sa.Date(), nullable=True),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('reconciled_status', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create orders_not_in_pos_data table
    op.create_table('orders_not_in_pos_data',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('zomato_order_id', sa.String(255), nullable=True),
        sa.Column('order_date', sa.Date(), nullable=True),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('zomato_net_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('reconciled_status', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create orders_not_in_3po_data table
    op.create_table('orders_not_in_3po_data',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('pos_order_id', sa.String(255), nullable=True),
        sa.Column('order_date', sa.Date(), nullable=True),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('pos_net_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('reconciled_status', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('orders_not_in_3po_data')
    op.drop_table('orders_not_in_pos_data')
    op.drop_table('zomato_3po_vs_pos_refund_data')
    op.drop_table('zomato_3po_vs_pos_data')
    op.drop_table('zomato_pos_vs_3po_data')
