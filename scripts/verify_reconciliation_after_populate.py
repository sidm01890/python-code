"""
Verify reconciliation after populate-threepo-dashboard was called
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


async def verify_after_populate():
    """Verify reconciliation after populate-threepo-dashboard"""
    try:
        logger.info("=" * 80)
        logger.info("✅ VERIFYING RECONCILIATION AFTER POPULATE")
        logger.info("=" * 80)
        
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # 1. Check summary table - matched records
            logger.info("\n📊 1. MATCHED RECORDS (Both POS and Zomato):")
            logger.info("-" * 80)
            matched_query = text("""
                SELECT 
                    COUNT(*) as matched_count,
                    SUM(COALESCE(pos_net_amount, 0)) as pos_net_total,
                    SUM(COALESCE(zomato_net_amount, 0)) as zomato_net_total,
                    SUM(COALESCE(pos_final_amount, 0)) as pos_final_total,
                    SUM(COALESCE(zomato_final_amount, 0)) as zomato_final_total
                FROM zomato_vs_pos_summary
                WHERE pos_order_id IS NOT NULL 
                    AND zomato_order_id IS NOT NULL
            """)
            result = await db.execute(matched_query)
            matched = result.fetchone()
            logger.info(f"   ✅ Matched records: {matched[0]}")
            logger.info(f"   ✅ POS Net Amount: {matched[1]}")
            logger.info(f"   ✅ Zomato Net Amount: {matched[2]}")
            logger.info(f"   ✅ POS Final Amount: {matched[3]}")
            logger.info(f"   ✅ Zomato Final Amount: {matched[4]}")
            
            # 2. Check DELIVERED orders specifically (as per report)
            logger.info("\n📊 2. DELIVERED ORDERS (As per Excel Report):")
            logger.info("-" * 80)
            delivered_query = text("""
                SELECT 
                    -- As per POS data (POS vs 3PO)
                    COUNT(CASE WHEN pos_order_id IS NOT NULL THEN 1 END) as pos_count,
                    SUM(CASE WHEN pos_order_id IS NOT NULL THEN COALESCE(pos_net_amount, 0) ELSE 0 END) as pos_amount,
                    SUM(CASE WHEN pos_order_id IS NOT NULL THEN COALESCE(zomato_net_amount, 0) ELSE 0 END) as pos_3po_amount,
                    SUM(CASE WHEN pos_order_id IS NOT NULL THEN COALESCE(pos_final_amount, 0) ELSE 0 END) as pos_receivable,
                    
                    -- As per 3PO Data (3PO vs POS)
                    COUNT(CASE WHEN zomato_order_id IS NOT NULL THEN 1 END) as zomato_count,
                    SUM(CASE WHEN zomato_order_id IS NOT NULL THEN COALESCE(zomato_net_amount, 0) ELSE 0 END) as zomato_3po_amount,
                    SUM(CASE WHEN zomato_order_id IS NOT NULL THEN COALESCE(pos_net_amount, 0) ELSE 0 END) as zomato_pos_amount,
                    SUM(CASE WHEN zomato_order_id IS NOT NULL THEN COALESCE(zomato_final_amount, 0) ELSE 0 END) as zomato_receivable
                FROM zomato_vs_pos_summary
                WHERE order_status_pos = 'Delivered' OR order_status_zomato IN ('sale', 'addition')
            """)
            result = await db.execute(delivered_query)
            delivered = result.fetchone()
            logger.info(f"\n   📋 As per POS data (POS vs 3PO):")
            logger.info(f"      No. of orders: {delivered[0]}")
            logger.info(f"      POS Amount: {delivered[1]}")
            logger.info(f"      3PO Amount: {delivered[2]}")
            logger.info(f"      Diff. in Amount: {delivered[1] - delivered[2]}")
            logger.info(f"      Amount Receivable: {delivered[3]}")
            logger.info(f"\n   📋 As per 3PO Data (3PO vs POS):")
            logger.info(f"      No. of orders: {delivered[4]}")
            logger.info(f"      3PO Amount: {delivered[5]}")
            logger.info(f"      POS Amount: {delivered[6]}")
            logger.info(f"      Diff. in Amount: {delivered[5] - delivered[6]}")
            logger.info(f"      Amount Receivable: {delivered[7]}")
            
            # 3. Check unreconciled orders
            logger.info("\n📊 3. UNRECONCILED ORDERS:")
            logger.info("-" * 80)
            unreconciled_query = text("""
                SELECT 
                    reconciled_status,
                    COUNT(*) as count,
                    SUM(COALESCE(unreconciled_amount, 0)) as unreconciled_total
                FROM zomato_vs_pos_summary
                WHERE reconciled_status = 'UNRECONCILED'
                GROUP BY reconciled_status
            """)
            result = await db.execute(unreconciled_query)
            unreconciled = result.fetchall()
            if unreconciled:
                for row in unreconciled:
                    logger.info(f"   ⚠️  {row[0]}: {row[1]} orders, Total: {row[2]}")
            else:
                logger.info("   ✅ No unreconciled orders found")
            
            # 4. Check for orders still missing
            logger.info("\n📊 4. CHECKING FOR MISSING ORDERS:")
            logger.info("-" * 80)
            missing_pos_query = text("""
                SELECT COUNT(*) as missing
                FROM orders o
                LEFT JOIN zomato_vs_pos_summary zvs ON o.instance_id = zvs.pos_order_id
                WHERE o.online_order_taker = 'ZOMATO'
                    AND o.instance_id IS NOT NULL
                    AND zvs.pos_order_id IS NULL
            """)
            result = await db.execute(missing_pos_query)
            missing_pos = result.scalar()
            
            missing_zomato_query = text("""
                SELECT COUNT(*) as missing
                FROM zomato z
                LEFT JOIN zomato_vs_pos_summary zvs ON z.order_id = zvs.zomato_order_id
                WHERE z.action IN ('sale', 'addition')
                    AND z.order_id IS NOT NULL
                    AND zvs.zomato_order_id IS NULL
            """)
            result = await db.execute(missing_zomato_query)
            missing_zomato = result.scalar()
            
            logger.info(f"   Orders not in summary: {missing_pos}")
            logger.info(f"   Zomato records not in summary: {missing_zomato}")
            
            if missing_pos == 0 and missing_zomato == 0:
                logger.info("   ✅ All records are in summary table!")
            
            # 5. Summary
            logger.info("\n" + "=" * 80)
            logger.info("📋 FINAL SUMMARY")
            logger.info("=" * 80)
            logger.info(f"✅ Matched records: {matched[0]}")
            logger.info(f"✅ POS orders in summary: {delivered[0]}")
            logger.info(f"✅ Zomato orders in summary: {delivered[4]}")
            logger.info(f"✅ POS Amount (should not be 0): {delivered[1]}")
            logger.info(f"✅ Zomato Amount: {delivered[5]}")
            
            if delivered[1] > 0:
                logger.info("\n✅ SUCCESS! POS Amount is now populated (not 0)")
            else:
                logger.warning("\n⚠️  WARNING: POS Amount is still 0 - check matching logic")
            
            if missing_pos == 0 and missing_zomato == 0:
                logger.info("✅ All orders are properly synced to summary table")
            else:
                logger.warning(f"⚠️  Still missing: {missing_pos} orders, {missing_zomato} zomato records")
            
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(verify_after_populate())


