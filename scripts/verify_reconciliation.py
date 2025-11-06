"""
Script to verify reconciliation calculations and check for missing data
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.config.database import create_engines, main_session_factory
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def verify_reconciliation():
    """Verify reconciliation data and calculations"""
    try:
        logger.info("=" * 80)
        logger.info("🔍 VERIFYING RECONCILIATION DATA")
        logger.info("=" * 80)
        
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # 1. Check orders table data
            logger.info("\n📊 1. CHECKING ORDERS TABLE:")
            logger.info("-" * 80)
            orders_query = text("""
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN online_order_taker = 'ZOMATO' THEN 1 END) as zomato_orders,
                    COUNT(CASE WHEN store_name IS NULL THEN 1 END) as null_store_name,
                    COUNT(CASE WHEN instance_id IS NULL THEN 1 END) as null_instance_id
                FROM orders
            """)
            result = await db.execute(orders_query)
            orders_stats = result.fetchone()
            logger.info(f"   Total orders: {orders_stats[0]}")
            logger.info(f"   ZOMATO orders: {orders_stats[1]}")
            logger.info(f"   Orders with NULL store_name: {orders_stats[2]}")
            logger.info(f"   Orders with NULL instance_id: {orders_stats[3]}")
            
            # 2. Check zomato table data
            logger.info("\n📊 2. CHECKING ZOMATO TABLE:")
            logger.info("-" * 80)
            zomato_query = text("""
                SELECT 
                    COUNT(*) as total_zomato,
                    COUNT(CASE WHEN action IN ('sale', 'addition') THEN 1 END) as sale_addition,
                    COUNT(CASE WHEN store_code IS NULL THEN 1 END) as null_store_code,
                    COUNT(CASE WHEN order_id IS NULL THEN 1 END) as null_order_id
                FROM zomato
            """)
            result = await db.execute(zomato_query)
            zomato_stats = result.fetchone()
            logger.info(f"   Total zomato records: {zomato_stats[0]}")
            logger.info(f"   Sale/Addition records: {zomato_stats[1]}")
            logger.info(f"   Records with NULL store_code: {zomato_stats[2]}")
            logger.info(f"   Records with NULL order_id: {zomato_stats[3]}")
            
            # 3. Check matching between zomato and orders
            logger.info("\n📊 3. CHECKING MATCHING BETWEEN ZOMATO AND ORDERS:")
            logger.info("-" * 80)
            matching_query = text("""
                SELECT 
                    COUNT(*) as matching_records
                FROM zomato z
                INNER JOIN orders o 
                    ON z.store_code = o.store_name 
                    AND z.order_id = o.instance_id
                WHERE z.action IN ('sale', 'addition')
                    AND o.online_order_taker = 'ZOMATO'
            """)
            result = await db.execute(matching_query)
            matching_count = result.scalar()
            logger.info(f"   Matching records: {matching_count}")
            
            # 4. Check zomato_vs_pos_summary table
            logger.info("\n📊 4. CHECKING ZOMATO_VS_POS_SUMMARY TABLE:")
            logger.info("-" * 80)
            summary_query = text("""
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL THEN 1 END) as with_pos_order_id,
                    COUNT(CASE WHEN zomato_order_id IS NOT NULL THEN 1 END) as with_zomato_order_id,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL AND zomato_order_id IS NOT NULL THEN 1 END) as matched_records,
                    COUNT(CASE WHEN pos_order_id IS NULL AND zomato_order_id IS NOT NULL THEN 1 END) as zomato_only,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL AND zomato_order_id IS NULL THEN 1 END) as pos_only,
                    SUM(COALESCE(pos_net_amount, 0)) as total_pos_net_amount,
                    SUM(COALESCE(zomato_net_amount, 0)) as total_zomato_net_amount,
                    SUM(COALESCE(pos_final_amount, 0)) as total_pos_final_amount,
                    SUM(COALESCE(zomato_final_amount, 0)) as total_zomato_final_amount
                FROM zomato_vs_pos_summary
            """)
            result = await db.execute(summary_query)
            summary_stats = result.fetchone()
            logger.info(f"   Total records: {summary_stats[0]}")
            logger.info(f"   Records with pos_order_id: {summary_stats[1]}")
            logger.info(f"   Records with zomato_order_id: {summary_stats[2]}")
            logger.info(f"   Matched records (both): {summary_stats[3]}")
            logger.info(f"   Zomato only (no POS): {summary_stats[4]}")
            logger.info(f"   POS only (no Zomato): {summary_stats[5]}")
            logger.info(f"   Total POS net amount: {summary_stats[6]}")
            logger.info(f"   Total Zomato net amount: {summary_stats[7]}")
            logger.info(f"   Total POS final amount: {summary_stats[8]}")
            logger.info(f"   Total Zomato final amount: {summary_stats[9]}")
            
            # 5. Check for orders that should be in summary but aren't
            logger.info("\n📊 5. CHECKING MISSING MATCHES:")
            logger.info("-" * 80)
            missing_pos_query = text("""
                SELECT COUNT(*) as missing_count
                FROM orders o
                LEFT JOIN zomato_vs_pos_summary zvs
                    ON o.instance_id = zvs.pos_order_id
                WHERE o.online_order_taker = 'ZOMATO'
                    AND o.instance_id IS NOT NULL
                    AND zvs.pos_order_id IS NULL
            """)
            result = await db.execute(missing_pos_query)
            missing_pos = result.scalar()
            logger.info(f"   Orders in orders table but not in summary (POS side): {missing_pos}")
            
            missing_zomato_query = text("""
                SELECT COUNT(*) as missing_count
                FROM zomato z
                LEFT JOIN zomato_vs_pos_summary zvs
                    ON z.order_id = zvs.zomato_order_id
                WHERE z.action IN ('sale', 'addition')
                    AND z.order_id IS NOT NULL
                    AND zvs.zomato_order_id IS NULL
            """)
            result = await db.execute(missing_zomato_query)
            missing_zomato = result.scalar()
            logger.info(f"   Zomato records not in summary (Zomato side): {missing_zomato}")
            
            # 6. Check DELIVERED orders specifically
            logger.info("\n📊 6. CHECKING DELIVERED ORDERS (As per report):")
            logger.info("-" * 80)
            delivered_query = text("""
                SELECT 
                    COUNT(*) as total_delivered,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL THEN 1 END) as pos_delivered,
                    COUNT(CASE WHEN zomato_order_id IS NOT NULL THEN 1 END) as zomato_delivered,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL AND zomato_order_id IS NOT NULL THEN 1 END) as both_delivered,
                    SUM(CASE WHEN pos_order_id IS NOT NULL THEN COALESCE(pos_net_amount, 0) ELSE 0 END) as pos_amount,
                    SUM(CASE WHEN zomato_order_id IS NOT NULL THEN COALESCE(zomato_net_amount, 0) ELSE 0 END) as zomato_amount,
                    SUM(CASE WHEN pos_order_id IS NOT NULL THEN COALESCE(pos_final_amount, 0) ELSE 0 END) as pos_final,
                    SUM(CASE WHEN zomato_order_id IS NOT NULL THEN COALESCE(zomato_final_amount, 0) ELSE 0 END) as zomato_final
                FROM zomato_vs_pos_summary
                WHERE order_status_pos = 'Delivered' OR order_status_zomato IN ('sale', 'addition')
            """)
            result = await db.execute(delivered_query)
            delivered_stats = result.fetchone()
            logger.info(f"   Total delivered records in summary: {delivered_stats[0]}")
            logger.info(f"   With POS order ID: {delivered_stats[1]}")
            logger.info(f"   With Zomato order ID: {delivered_stats[2]}")
            logger.info(f"   With both: {delivered_stats[3]}")
            logger.info(f"   POS Amount (net): {delivered_stats[4]}")
            logger.info(f"   Zomato Amount (net): {delivered_stats[5]}")
            logger.info(f"   POS Amount (final): {delivered_stats[6]}")
            logger.info(f"   Zomato Amount (final): {delivered_stats[7]}")
            
            # 7. Check reconciliation status
            logger.info("\n📊 7. CHECKING RECONCILIATION STATUS:")
            logger.info("-" * 80)
            recon_query = text("""
                SELECT 
                    reconciled_status,
                    COUNT(*) as count,
                    SUM(COALESCE(reconciled_amount, 0)) as reconciled_total,
                    SUM(COALESCE(unreconciled_amount, 0)) as unreconciled_total
                FROM zomato_vs_pos_summary
                GROUP BY reconciled_status
            """)
            result = await db.execute(recon_query)
            recon_stats = result.fetchall()
            for stat in recon_stats:
                logger.info(f"   {stat[0]}: {stat[1]} records, Reconciled: {stat[2]}, Unreconciled: {stat[3]}")
            
            # 8. Summary
            logger.info("\n" + "=" * 80)
            logger.info("📋 SUMMARY")
            logger.info("=" * 80)
            logger.info(f"✅ Orders table: {orders_stats[1]} ZOMATO orders")
            logger.info(f"✅ Zomato table: {zomato_stats[1]} sale/addition records")
            logger.info(f"✅ Direct matching: {matching_count} records")
            logger.info(f"✅ Summary table: {summary_stats[0]} total records")
            logger.info(f"   - Matched: {summary_stats[3]}")
            logger.info(f"   - Zomato only: {summary_stats[4]}")
            logger.info(f"   - POS only: {summary_stats[5]}")
            logger.info(f"⚠️  Missing from summary:")
            logger.info(f"   - Orders not in summary: {missing_pos}")
            logger.info(f"   - Zomato not in summary: {missing_zomato}")
            
            if missing_pos > 0 or missing_zomato > 0:
                logger.warning("\n⚠️  ACTION REQUIRED: Run /populate-threepo-dashboard to sync summary table")
            
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(verify_reconciliation())


