"""
Check why POS is only showing 25 orders instead of 121
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


async def check_pos_parsing():
    """Check POS parsing issue"""
    try:
        logger.info("=" * 80)
        logger.info("🔍 CHECKING POS PARSING ISSUE")
        logger.info("=" * 80)
        
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # Check total orders in orders table
            logger.info("\n📊 Checking orders table:")
            logger.info("-" * 80)
            query1 = text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN net_sale IS NOT NULL THEN 1 END) as has_net_sale,
                    COUNT(CASE WHEN net_sale IS NULL THEN 1 END) as null_net_sale,
                    COUNT(CASE WHEN instance_id IS NOT NULL THEN 1 END) as has_instance_id
                FROM orders
                WHERE online_order_taker = 'ZOMATO'
            """)
            result1 = await db.execute(query1)
            stats1 = result1.fetchone()
            logger.info(f"   Total ZOMATO orders: {stats1[0]}")
            logger.info(f"   Orders with net_sale: {stats1[1]}")
            logger.info(f"   Orders with NULL net_sale: {stats1[2]}")
            logger.info(f"   Orders with instance_id: {stats1[3]}")
            
            # Check orders that should be in summary but aren't
            logger.info("\n📊 Checking orders NOT in summary table:")
            logger.info("-" * 80)
            query2 = text("""
                SELECT 
                    COUNT(*) as missing_count
                FROM orders o
                LEFT JOIN zomato_vs_pos_summary zvs 
                    ON o.instance_id = zvs.pos_order_id
                WHERE o.online_order_taker = 'ZOMATO'
                    AND o.instance_id IS NOT NULL
                    AND zvs.pos_order_id IS NULL
            """)
            result2 = await db.execute(query2)
            missing = result2.fetchone()
            logger.info(f"   Orders NOT in summary: {missing[0]}")
            
            # Sample missing orders
            query3 = text("""
                SELECT 
                    o.instance_id,
                    o.store_name,
                    o.date,
                    o.net_sale,
                    o.payment
                FROM orders o
                LEFT JOIN zomato_vs_pos_summary zvs 
                    ON o.instance_id = zvs.pos_order_id
                WHERE o.online_order_taker = 'ZOMATO'
                    AND o.instance_id IS NOT NULL
                    AND zvs.pos_order_id IS NULL
                LIMIT 10
            """)
            result3 = await db.execute(query3)
            missing_orders = result3.fetchall()
            logger.info(f"\n   Sample missing orders ({len(missing_orders)}):")
            for order in missing_orders:
                logger.info(f"      Instance ID: {order.instance_id}, Store: {order.store_name}, Net Sale: {order.net_sale}, Payment: {order.payment}")
            
            # Check summary table
            logger.info("\n📊 Checking summary table:")
            logger.info("-" * 80)
            query4 = text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL THEN 1 END) as with_pos,
                    COUNT(CASE WHEN zomato_order_id IS NOT NULL THEN 1 END) as with_zomato,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL AND zomato_order_id IS NOT NULL THEN 1 END) as matched,
                    COUNT(CASE WHEN reconciled_status IS NOT NULL THEN 1 END) as with_status,
                    COUNT(CASE WHEN reconciled_status = 'RECONCILED' THEN 1 END) as reconciled,
                    COUNT(CASE WHEN reconciled_status = 'UNRECONCILED' THEN 1 END) as unreconciled,
                    COUNT(CASE WHEN reconciled_status = 'PENDING' THEN 1 END) as pending
                FROM zomato_vs_pos_summary
            """)
            result4 = await db.execute(query4)
            stats4 = result4.fetchone()
            logger.info(f"   Total summary records: {stats4[0]}")
            logger.info(f"   With POS order ID: {stats4[1]}")
            logger.info(f"   With Zomato order ID: {stats4[2]}")
            logger.info(f"   Matched (both): {stats4[3]}")
            logger.info(f"   With reconciliation status: {stats4[4]}")
            logger.info(f"   RECONCILED: {stats4[5]}")
            logger.info(f"   UNRECONCILED: {stats4[6]}")
            logger.info(f"   PENDING: {stats4[7]}")
            
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(check_pos_parsing())

