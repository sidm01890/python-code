"""
Script to run populate-threepo-dashboard logic directly
Extracts and runs the core functions without API dependencies
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.config.database import create_engines, main_session_factory
from datetime import datetime
from decimal import Decimal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def calculate_slab_rate(net_amount):
    """Calculate slab rate based on net amount"""
    if net_amount < 400:
        return 0.165
    elif net_amount < 450:
        return 0.1525
    elif net_amount < 500:
        return 0.145
    elif net_amount < 550:
        return 0.1375
    elif net_amount < 600:
        return 0.1325
    else:
        return 0.1275


async def create_pos_summary_records(db):
    """Create POS summary records from orders table"""
    logger.info("📍 [createPosSummaryRecords] Function started")
    try:
        count_query = text("SELECT COUNT(*) as cnt FROM orders WHERE online_order_taker = 'ZOMATO'")
        result = await db.execute(count_query)
        row = result.fetchone()
        total_count = row.cnt if row else 0
        logger.info(f"📍 [createPosSummaryRecords] Total POS orders found: {total_count}")
        
        if total_count == 0:
            logger.info("📍 [createPosSummaryRecords] No POS orders found")
            return {"processed": 0, "updated": 0, "errors": 0}
        
        BATCH_SIZE = 1000
        offset = 0
        total_processed = 0
        total_created = 0
        total_updated = 0
        
        while offset < total_count:
            logger.info(f"📍 [createPosSummaryRecords] Fetching batch: offset={offset}, limit={BATCH_SIZE}")
            
            batch_query = text("""
                SELECT 
                    instance_id, store_name, date, payment,
                    subtotal, discount, net_sale, gst_at_5_percent,
                    gst_ecom_at_5_percent, packaging_charge, gross_amount
                FROM orders
                WHERE online_order_taker = 'ZOMATO'
                ORDER BY instance_id ASC
                LIMIT :limit OFFSET :offset
            """)
            
            result = await db.execute(batch_query, {"limit": BATCH_SIZE, "offset": offset})
            pos_orders = result.fetchall()
            
            if not pos_orders or len(pos_orders) == 0:
                break
            
            order_ids = [order.instance_id for order in pos_orders if order.instance_id]
            existing_records = {}
            if order_ids:
                placeholders = ",".join([f":id_{i}" for i in range(len(order_ids))])
                existing_query = text(f"""
                    SELECT id, pos_order_id, zomato_order_id
                    FROM zomato_vs_pos_summary
                    WHERE pos_order_id IN ({placeholders})
                       OR zomato_order_id IN ({placeholders})
                """)
                params_existing = {f"id_{i}": order_id for i, order_id in enumerate(order_ids)}
                result_existing = await db.execute(existing_query, params_existing)
                for row in result_existing.fetchall():
                    if row.pos_order_id:
                        existing_records[row.pos_order_id] = row.id
                    if row.zomato_order_id:
                        existing_records[row.zomato_order_id] = row.id
            
            bulk_create_records = []
            bulk_update_records = []
            
            for order in pos_orders:
                try:
                    payment = float(order.payment or order.net_sale or 0)
                    slab_rate = await calculate_slab_rate(payment)
                    
                    pos_net_amount = payment
                    pos_tax_paid_by_customer = payment * 0.05
                    pos_commission_value = pos_net_amount * slab_rate
                    pos_pg_applied_on = pos_net_amount + pos_tax_paid_by_customer
                    pos_pg_charge = pos_pg_applied_on * 0.011
                    pos_taxes_zomato_fee = (pos_commission_value + pos_pg_charge) * 0.18
                    pos_tds_amount = pos_net_amount * 0.001
                    pos_final_amount = pos_net_amount - pos_commission_value - pos_pg_charge - pos_taxes_zomato_fee - pos_tds_amount
                    
                    record_data = {
                        "pos_order_id": order.instance_id,
                        "store_name": order.store_name,
                        "order_date": order.date,
                        "pos_net_amount": Decimal(str(pos_net_amount)),
                        "pos_tax_paid_by_customer": Decimal(str(pos_tax_paid_by_customer)),
                        "pos_commission_value": Decimal(str(pos_commission_value)),
                        "pos_pg_applied_on": Decimal(str(pos_pg_applied_on)),
                        "pos_pg_charge": Decimal(str(pos_pg_charge)),
                        "pos_taxes_zomato_fee": Decimal(str(pos_taxes_zomato_fee)),
                        "pos_tds_amount": Decimal(str(pos_tds_amount)),
                        "pos_final_amount": Decimal(str(pos_final_amount)),
                        "order_status_pos": "Delivered",
                        "updated_at": datetime.utcnow(),
                    }
                    
                    record_id = None
                    if order.instance_id in existing_records:
                        record_id = existing_records[order.instance_id]
                    if not record_id:
                        check_zomato_query = text("""
                            SELECT id FROM zomato_vs_pos_summary
                            WHERE zomato_order_id = :instance_id
                            LIMIT 1
                        """)
                        result_zomato = await db.execute(check_zomato_query, {"instance_id": order.instance_id})
                        zomato_row = result_zomato.fetchone()
                        if zomato_row:
                            record_id = zomato_row.id
                    
                    if record_id:
                        record_data["id"] = record_id
                        bulk_update_records.append(record_data)
                        total_updated += 1
                    else:
                        record_data["id"] = f"ZVS_{order.instance_id}"
                        record_data["reconciled_status"] = "PENDING"
                        record_data["created_at"] = datetime.utcnow()
                        bulk_create_records.append(record_data)
                        total_created += 1
                        
                except Exception as error:
                    logger.error(f"Error processing order {order.instance_id if order else 'unknown'}: {error}")
            
            if bulk_create_records:
                insert_query = text("""
                    INSERT INTO zomato_vs_pos_summary (
                        id, pos_order_id, store_name, order_date,
                        pos_net_amount, pos_tax_paid_by_customer, pos_commission_value,
                        pos_pg_applied_on, pos_pg_charge, pos_taxes_zomato_fee,
                        pos_tds_amount, pos_final_amount, order_status_pos,
                        reconciled_status, created_at, updated_at
                    ) VALUES (
                        :id, :pos_order_id, :store_name, :order_date,
                        :pos_net_amount, :pos_tax_paid_by_customer, :pos_commission_value,
                        :pos_pg_applied_on, :pos_pg_charge, :pos_taxes_zomato_fee,
                        :pos_tds_amount, :pos_final_amount, :order_status_pos,
                        :reconciled_status, :created_at, :updated_at
                    )
                    ON DUPLICATE KEY UPDATE
                        pos_order_id = VALUES(pos_order_id),
                        store_name = VALUES(store_name),
                        order_date = VALUES(order_date),
                        pos_net_amount = VALUES(pos_net_amount),
                        pos_tax_paid_by_customer = VALUES(pos_tax_paid_by_customer),
                        pos_commission_value = VALUES(pos_commission_value),
                        pos_pg_applied_on = VALUES(pos_pg_applied_on),
                        pos_pg_charge = VALUES(pos_pg_charge),
                        pos_taxes_zomato_fee = VALUES(pos_taxes_zomato_fee),
                        pos_tds_amount = VALUES(pos_tds_amount),
                        pos_final_amount = VALUES(pos_final_amount),
                        order_status_pos = VALUES(order_status_pos),
                        updated_at = VALUES(updated_at)
                """)
                for record in bulk_create_records:
                    await db.execute(insert_query, record)
                await db.commit()
                logger.info(f"📍 [createPosSummaryRecords] Created {len(bulk_create_records)} records")
            
            if bulk_update_records:
                update_query = text("""
                    UPDATE zomato_vs_pos_summary SET
                        pos_order_id = :pos_order_id,
                        store_name = :store_name,
                        order_date = :order_date,
                        pos_net_amount = :pos_net_amount,
                        pos_tax_paid_by_customer = :pos_tax_paid_by_customer,
                        pos_commission_value = :pos_commission_value,
                        pos_pg_applied_on = :pos_pg_applied_on,
                        pos_pg_charge = :pos_pg_charge,
                        pos_taxes_zomato_fee = :pos_taxes_zomato_fee,
                        pos_tds_amount = :pos_tds_amount,
                        pos_final_amount = :pos_final_amount,
                        order_status_pos = :order_status_pos,
                        updated_at = :updated_at
                    WHERE id = :id
                """)
                for record in bulk_update_records:
                    await db.execute(update_query, record)
                await db.commit()
                logger.info(f"📍 [createPosSummaryRecords] Updated {len(bulk_update_records)} records")
            
            total_processed += len(pos_orders)
            offset += BATCH_SIZE
        
        logger.info(f"✅ [createPosSummaryRecords] Completed: {total_processed} processed, {total_created} created, {total_updated} updated")
        return {"processed": total_processed, "created": total_created, "updated": total_updated, "errors": 0}
        
    except Exception as error:
        logger.error(f"❌ [createPosSummaryRecords] Error: {error}", exc_info=True)
        return {"processed": 0, "created": 0, "updated": 0, "errors": 1}


async def create_zomato_summary_records(db):
    """Create Zomato summary records from zomato table"""
    logger.info("📍 [createZomatoSummaryRecords] Function started")
    try:
        count_query = text("SELECT COUNT(*) as cnt FROM zomato WHERE action IN ('sale', 'addition')")
        result = await db.execute(count_query)
        row = result.fetchone()
        total_count = row.cnt if row else 0
        logger.info(f"📍 [createZomatoSummaryRecords] Total Zomato orders found: {total_count}")
        
        if total_count == 0:
            return {"processed": 0, "updated": 0, "errors": 0}
        
        BATCH_SIZE = 1000
        offset = 0
        total_processed = 0
        total_created = 0
        total_updated = 0
        
        while offset < total_count:
            batch_query = text("""
                SELECT 
                    order_id, store_code, order_date, action,
                    bill_subtotal, mvd, merchant_pack_charge,
                    net_amount, tax_paid_by_customer, commission_value,
                    pg_applied_on, pgcharge, taxes_zomato_fee, tds_amount, final_amount,
                    credit_note_amount, pro_discount_passthrough, customer_discount,
                    rejection_penalty_charge, user_credits_charge, promo_recovery_adj,
                    icecream_handling, icecream_deductions, order_support_cost,
                    merchant_delivery_charge
                FROM zomato
                WHERE action IN ('sale', 'addition')
                ORDER BY order_id ASC
                LIMIT :limit OFFSET :offset
            """)
            
            result = await db.execute(batch_query, {"limit": BATCH_SIZE, "offset": offset})
            zomato_orders = result.fetchall()
            
            if not zomato_orders:
                break
            
            order_ids = [order.order_id for order in zomato_orders if order.order_id]
            existing_records = {}
            if order_ids:
                placeholders = ",".join([f":id_{i}" for i in range(len(order_ids))])
                existing_query = text(f"""
                    SELECT id, zomato_order_id, pos_order_id
                    FROM zomato_vs_pos_summary
                    WHERE zomato_order_id IN ({placeholders})
                       OR pos_order_id IN ({placeholders})
                """)
                params_existing = {f"id_{i}": order_id for i, order_id in enumerate(order_ids)}
                result_existing = await db.execute(existing_query, params_existing)
                for row in result_existing.fetchall():
                    if row.zomato_order_id:
                        existing_records[row.zomato_order_id] = row.id
                    if row.pos_order_id:
                        existing_records[row.pos_order_id] = row.id
            
            bulk_create_records = []
            bulk_update_records = []
            
            for order in zomato_orders:
                try:
                    bill_subtotal = float(order.bill_subtotal or 0)
                    mvd = float(order.mvd or 0)
                    merchant_pack_charge = float(order.merchant_pack_charge or 0)
                    net_amount = float(order.net_amount or 0)
                    
                    slab_rate = await calculate_slab_rate(net_amount)
                    
                    calculated_zomato_net_amount = bill_subtotal - mvd + merchant_pack_charge
                    calculated_zomato_tax_paid_by_customer = calculated_zomato_net_amount * 0.05
                    calculated_zomato_commission_value = calculated_zomato_net_amount * slab_rate
                    calculated_zomato_pg_applied_on = calculated_zomato_net_amount + calculated_zomato_tax_paid_by_customer
                    calculated_zomato_pg_charge = calculated_zomato_pg_applied_on * 0.011
                    calculated_zomato_taxes_zomato_fee = (calculated_zomato_commission_value + calculated_zomato_pg_charge) * 0.18
                    calculated_zomato_tds_amount = calculated_zomato_net_amount * 0.001
                    calculated_zomato_final_amount = calculated_zomato_net_amount - calculated_zomato_commission_value - calculated_zomato_pg_charge - calculated_zomato_taxes_zomato_fee - calculated_zomato_tds_amount
                    
                    zomato_net_amount = float(order.net_amount or calculated_zomato_net_amount)
                    zomato_tax_paid_by_customer = float(order.tax_paid_by_customer or calculated_zomato_tax_paid_by_customer)
                    zomato_commission_value = float(order.commission_value or calculated_zomato_commission_value)
                    zomato_pg_applied_on = float(order.pg_applied_on or calculated_zomato_pg_applied_on)
                    zomato_pg_charge = float(order.pgcharge or calculated_zomato_pg_charge)
                    zomato_taxes_zomato_fee = float(order.taxes_zomato_fee or calculated_zomato_taxes_zomato_fee)
                    zomato_tds_amount = float(order.tds_amount or calculated_zomato_tds_amount)
                    zomato_final_amount = float(order.final_amount or calculated_zomato_final_amount)
                    
                    record_data = {
                        "zomato_order_id": order.order_id,
                        "store_name": order.store_code,
                        "order_date": order.order_date,
                        "zomato_net_amount": Decimal(str(zomato_net_amount)),
                        "zomato_tax_paid_by_customer": Decimal(str(zomato_tax_paid_by_customer)),
                        "zomato_commission_value": Decimal(str(zomato_commission_value)),
                        "zomato_pg_applied_on": Decimal(str(zomato_pg_applied_on)),
                        "zomato_pg_charge": Decimal(str(zomato_pg_charge)),
                        "zomato_taxes_zomato_fee": Decimal(str(zomato_taxes_zomato_fee)),
                        "zomato_tds_amount": Decimal(str(zomato_tds_amount)),
                        "zomato_final_amount": Decimal(str(zomato_final_amount)),
                        "calculated_zomato_net_amount": Decimal(str(calculated_zomato_net_amount)),
                        "calculated_zomato_tax_paid_by_customer": Decimal(str(calculated_zomato_tax_paid_by_customer)),
                        "calculated_zomato_commission_value": Decimal(str(calculated_zomato_commission_value)),
                        "calculated_zomato_pg_applied_on": Decimal(str(calculated_zomato_pg_applied_on)),
                        "calculated_zomato_pg_charge": Decimal(str(calculated_zomato_pg_charge)),
                        "calculated_zomato_taxes_zomato_fee": Decimal(str(calculated_zomato_taxes_zomato_fee)),
                        "calculated_zomato_tds_amount": Decimal(str(calculated_zomato_tds_amount)),
                        "calculated_zomato_final_amount": Decimal(str(calculated_zomato_final_amount)),
                        "fixed_credit_note_amount": Decimal(str(order.credit_note_amount or 0)),
                        "fixed_pro_discount_passthrough": Decimal(str(order.pro_discount_passthrough or 0)),
                        "fixed_customer_discount": Decimal(str(order.customer_discount or 0)),
                        "fixed_rejection_penalty_charge": Decimal(str(order.rejection_penalty_charge or 0)),
                        "fixed_user_credits_charge": Decimal(str(order.user_credits_charge or 0)),
                        "fixed_promo_recovery_adj": Decimal(str(order.promo_recovery_adj or 0)),
                        "fixed_icecream_handling": Decimal(str(order.icecream_handling or 0)),
                        "fixed_icecream_deductions": Decimal(str(order.icecream_deductions or 0)),
                        "fixed_order_support_cost": Decimal(str(order.order_support_cost or 0)),
                        "fixed_merchant_delivery_charge": Decimal(str(order.merchant_delivery_charge or 0)),
                        "order_status_zomato": order.action,
                        "updated_at": datetime.utcnow(),
                    }
                    
                    record_id = None
                    if order.order_id in existing_records:
                        record_id = existing_records[order.order_id]
                    if not record_id:
                        check_pos_query = text("""
                            SELECT id FROM zomato_vs_pos_summary
                            WHERE pos_order_id = :order_id
                            LIMIT 1
                        """)
                        result_pos = await db.execute(check_pos_query, {"order_id": order.order_id})
                        pos_row = result_pos.fetchone()
                        if pos_row:
                            record_id = pos_row.id
                    
                    if record_id:
                        record_data["id"] = record_id
                        bulk_update_records.append(record_data)
                        total_updated += 1
                    else:
                        record_data["id"] = f"ZVS_{order.order_id}"
                        record_data["reconciled_status"] = "PENDING"
                        record_data["created_at"] = datetime.utcnow()
                        bulk_create_records.append(record_data)
                        total_created += 1
                        
                except Exception as error:
                    logger.error(f"Error processing order {order.order_id if order else 'unknown'}: {error}")
            
            if bulk_create_records:
                # Simplified insert - only key fields
                insert_query = text("""
                    INSERT INTO zomato_vs_pos_summary (
                        id, zomato_order_id, store_name, order_date,
                        zomato_net_amount, zomato_tax_paid_by_customer, zomato_commission_value,
                        zomato_pg_applied_on, zomato_pg_charge, zomato_taxes_zomato_fee,
                        zomato_tds_amount, zomato_final_amount,
                        calculated_zomato_net_amount, calculated_zomato_tax_paid_by_customer,
                        calculated_zomato_commission_value, calculated_zomato_pg_applied_on,
                        calculated_zomato_pg_charge, calculated_zomato_taxes_zomato_fee,
                        calculated_zomato_tds_amount, calculated_zomato_final_amount,
                        fixed_credit_note_amount, fixed_pro_discount_passthrough,
                        fixed_customer_discount, fixed_rejection_penalty_charge,
                        fixed_user_credits_charge, fixed_promo_recovery_adj,
                        fixed_icecream_handling, fixed_icecream_deductions,
                        fixed_order_support_cost, fixed_merchant_delivery_charge,
                        order_status_zomato, reconciled_status, created_at, updated_at
                    ) VALUES (
                        :id, :zomato_order_id, :store_name, :order_date,
                        :zomato_net_amount, :zomato_tax_paid_by_customer, :zomato_commission_value,
                        :zomato_pg_applied_on, :zomato_pg_charge, :zomato_taxes_zomato_fee,
                        :zomato_tds_amount, :zomato_final_amount,
                        :calculated_zomato_net_amount, :calculated_zomato_tax_paid_by_customer,
                        :calculated_zomato_commission_value, :calculated_zomato_pg_applied_on,
                        :calculated_zomato_pg_charge, :calculated_zomato_taxes_zomato_fee,
                        :calculated_zomato_tds_amount, :calculated_zomato_final_amount,
                        :fixed_credit_note_amount, :fixed_pro_discount_passthrough,
                        :fixed_customer_discount, :fixed_rejection_penalty_charge,
                        :fixed_user_credits_charge, :fixed_promo_recovery_adj,
                        :fixed_icecream_handling, :fixed_icecream_deductions,
                        :fixed_order_support_cost, :fixed_merchant_delivery_charge,
                        :order_status_zomato, :reconciled_status, :created_at, :updated_at
                    )
                    ON DUPLICATE KEY UPDATE
                        zomato_order_id = VALUES(zomato_order_id),
                        store_name = VALUES(store_name),
                        order_date = VALUES(order_date),
                        zomato_net_amount = VALUES(zomato_net_amount),
                        zomato_tax_paid_by_customer = VALUES(zomato_tax_paid_by_customer),
                        zomato_commission_value = VALUES(zomato_commission_value),
                        zomato_pg_applied_on = VALUES(zomato_pg_applied_on),
                        zomato_pg_charge = VALUES(zomato_pg_charge),
                        zomato_taxes_zomato_fee = VALUES(zomato_taxes_zomato_fee),
                        zomato_tds_amount = VALUES(zomato_tds_amount),
                        zomato_final_amount = VALUES(zomato_final_amount),
                        calculated_zomato_net_amount = VALUES(calculated_zomato_net_amount),
                        calculated_zomato_tax_paid_by_customer = VALUES(calculated_zomato_tax_paid_by_customer),
                        calculated_zomato_commission_value = VALUES(calculated_zomato_commission_value),
                        calculated_zomato_pg_applied_on = VALUES(calculated_zomato_pg_applied_on),
                        calculated_zomato_pg_charge = VALUES(calculated_zomato_pg_charge),
                        calculated_zomato_taxes_zomato_fee = VALUES(calculated_zomato_taxes_zomato_fee),
                        calculated_zomato_tds_amount = VALUES(calculated_zomato_tds_amount),
                        calculated_zomato_final_amount = VALUES(calculated_zomato_final_amount),
                        fixed_credit_note_amount = VALUES(fixed_credit_note_amount),
                        fixed_pro_discount_passthrough = VALUES(fixed_pro_discount_passthrough),
                        fixed_customer_discount = VALUES(fixed_customer_discount),
                        fixed_rejection_penalty_charge = VALUES(fixed_rejection_penalty_charge),
                        fixed_user_credits_charge = VALUES(fixed_user_credits_charge),
                        fixed_promo_recovery_adj = VALUES(fixed_promo_recovery_adj),
                        fixed_icecream_handling = VALUES(fixed_icecream_handling),
                        fixed_icecream_deductions = VALUES(fixed_icecream_deductions),
                        fixed_order_support_cost = VALUES(fixed_order_support_cost),
                        fixed_merchant_delivery_charge = VALUES(fixed_merchant_delivery_charge),
                        order_status_zomato = VALUES(order_status_zomato),
                        updated_at = VALUES(updated_at)
                """)
                for record in bulk_create_records:
                    await db.execute(insert_query, record)
                await db.commit()
                logger.info(f"📍 [createZomatoSummaryRecords] Created {len(bulk_create_records)} records")
            
            if bulk_update_records:
                # Update query - simplified version
                update_query = text("""
                    UPDATE zomato_vs_pos_summary SET
                        zomato_order_id = :zomato_order_id,
                        store_name = :store_name,
                        order_date = :order_date,
                        zomato_net_amount = :zomato_net_amount,
                        zomato_tax_paid_by_customer = :zomato_tax_paid_by_customer,
                        zomato_commission_value = :zomato_commission_value,
                        zomato_pg_applied_on = :zomato_pg_applied_on,
                        zomato_pg_charge = :zomato_pg_charge,
                        zomato_taxes_zomato_fee = :zomato_taxes_zomato_fee,
                        zomato_tds_amount = :zomato_tds_amount,
                        zomato_final_amount = :zomato_final_amount,
                        calculated_zomato_net_amount = :calculated_zomato_net_amount,
                        calculated_zomato_tax_paid_by_customer = :calculated_zomato_tax_paid_by_customer,
                        calculated_zomato_commission_value = :calculated_zomato_commission_value,
                        calculated_zomato_pg_applied_on = :calculated_zomato_pg_applied_on,
                        calculated_zomato_pg_charge = :calculated_zomato_pg_charge,
                        calculated_zomato_taxes_zomato_fee = :calculated_zomato_taxes_zomato_fee,
                        calculated_zomato_tds_amount = :calculated_zomato_tds_amount,
                        calculated_zomato_final_amount = :calculated_zomato_final_amount,
                        fixed_credit_note_amount = :fixed_credit_note_amount,
                        fixed_pro_discount_passthrough = :fixed_pro_discount_passthrough,
                        fixed_customer_discount = :fixed_customer_discount,
                        fixed_rejection_penalty_charge = :fixed_rejection_penalty_charge,
                        fixed_user_credits_charge = :fixed_user_credits_charge,
                        fixed_promo_recovery_adj = :fixed_promo_recovery_adj,
                        fixed_icecream_handling = :fixed_icecream_handling,
                        fixed_icecream_deductions = :fixed_icecream_deductions,
                        fixed_order_support_cost = :fixed_order_support_cost,
                        fixed_merchant_delivery_charge = :fixed_merchant_delivery_charge,
                        order_status_zomato = :order_status_zomato,
                        updated_at = :updated_at
                    WHERE id = :id
                """)
                for record in bulk_update_records:
                    await db.execute(update_query, record)
                await db.commit()
                logger.info(f"📍 [createZomatoSummaryRecords] Updated {len(bulk_update_records)} records")
            
            total_processed += len(zomato_orders)
            offset += BATCH_SIZE
        
        logger.info(f"✅ [createZomatoSummaryRecords] Completed: {total_processed} processed, {total_created} created, {total_updated} updated")
        return {"processed": total_processed, "created": total_created, "updated": total_updated, "errors": 0}
        
    except Exception as error:
        logger.error(f"❌ [createZomatoSummaryRecords] Error: {error}", exc_info=True)
        return {"processed": 0, "created": 0, "updated": 0, "errors": 1}


async def main():
    """Main function"""
    try:
        logger.info("=" * 80)
        logger.info("🚀 RUNNING POPULATE-THREEPO-DASHBOARD")
        logger.info("=" * 80)
        
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # Step 1: Create POS Summary Records
            logger.info("\n🔵 STEP 1: Creating POS Summary Records")
            logger.info("-" * 80)
            pos_result = await create_pos_summary_records(db)
            logger.info(f"✅ POS Summary: {pos_result}")
            
            # Step 2: Create Zomato Summary Records
            logger.info("\n🔵 STEP 2: Creating Zomato Summary Records")
            logger.info("-" * 80)
            zomato_result = await create_zomato_summary_records(db)
            logger.info(f"✅ Zomato Summary: {zomato_result}")
            
            # Verify results
            logger.info("\n📊 VERIFYING RESULTS:")
            logger.info("-" * 80)
            verify_query = text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL AND zomato_order_id IS NOT NULL THEN 1 END) as matched
                FROM zomato_vs_pos_summary
            """)
            result = await db.execute(verify_query)
            stats = result.fetchone()
            logger.info(f"   Total records: {stats[0]}")
            logger.info(f"   Matched records: {stats[1]}")
            
            logger.info("\n" + "=" * 80)
            logger.info("✅ COMPLETED")
            logger.info("=" * 80)
            logger.info(f"Processed: {pos_result.get('processed', 0) + zomato_result.get('processed', 0)}")
            logger.info(f"Created: {pos_result.get('created', 0) + zomato_result.get('created', 0)}")
            logger.info(f"Updated: {pos_result.get('updated', 0) + zomato_result.get('updated', 0)}")
            logger.info(f"Matched records: {stats[1]}")
            
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())


