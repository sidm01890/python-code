"""
Check why POS amounts are showing as 0
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


async def check_issue():
    """Check the payment field issue"""
    try:
        logger.info("=" * 80)
        logger.info("🔍 CHECKING POS CALCULATION ISSUE")
        logger.info("=" * 80)
        
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # Check orders we inserted
            logger.info("\n📊 Checking newly inserted orders:")
            logger.info("-" * 80)
            query = text("""
                SELECT 
                    instance_id,
                    store_name,
                    date,
                    payment,
                    net_sale,
                    subtotal,
                    discount,
                    gross_amount,
                    online_order_taker
                FROM orders
                WHERE online_order_taker = 'ZOMATO'
                    AND instance_id IN (
                        SELECT order_id FROM zomato WHERE action IN ('sale', 'addition')
                    )
                LIMIT 10
            """)
            result = await db.execute(query)
            orders = result.fetchall()
            
            logger.info(f"   Found {len(orders)} sample orders")
            for order in orders:
                logger.info(f"   Order ID: {order.instance_id}")
                logger.info(f"      Payment: {order.payment}")
                logger.info(f"      Net Sale: {order.net_sale}")
                logger.info(f"      Subtotal: {order.subtotal}")
                logger.info(f"      Gross Amount: {order.gross_amount}")
            
            # Check summary table
            logger.info("\n📊 Checking summary table POS amounts:")
            logger.info("-" * 80)
            query2 = text("""
                SELECT 
                    pos_order_id,
                    pos_net_amount,
                    zomato_order_id,
                    zomato_net_amount
                FROM zomato_vs_pos_summary
                WHERE pos_order_id IS NOT NULL
                ORDER BY pos_order_id
                LIMIT 10
            """)
            result2 = await db.execute(query2)
            summary_records = result2.fetchall()
            
            logger.info(f"   Found {len(summary_records)} summary records")
            for record in summary_records:
                logger.info(f"   POS Order ID: {record.pos_order_id}")
                logger.info(f"      POS Net Amount: {record.pos_net_amount}")
                logger.info(f"      Zomato Order ID: {record.zomato_order_id}")
                logger.info(f"      Zomato Net Amount: {record.zomato_net_amount}")
            
            # Count orders with NULL payment but have net_sale
            logger.info("\n📊 Checking orders with NULL payment:")
            logger.info("-" * 80)
            query3 = text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN payment IS NULL THEN 1 END) as null_payment,
                    COUNT(CASE WHEN payment IS NOT NULL THEN 1 END) as has_payment,
                    COUNT(CASE WHEN net_sale IS NOT NULL AND payment IS NULL THEN 1 END) as has_net_sale_no_payment
                FROM orders
                WHERE online_order_taker = 'ZOMATO'
            """)
            result3 = await db.execute(query3)
            stats = result3.fetchone()
            
            logger.info(f"   Total ZOMATO orders: {stats[0]}")
            logger.info(f"   Orders with NULL payment: {stats[1]}")
            logger.info(f"   Orders with payment: {stats[2]}")
            logger.info(f"   Orders with net_sale but NULL payment: {stats[3]}")
            
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(check_issue())

