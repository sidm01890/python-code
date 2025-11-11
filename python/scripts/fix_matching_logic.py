"""
Script to check and fix the matching logic between POS and Zomato records
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


async def check_matching():
    """Check why POS and Zomato records aren't matching"""
    try:
        logger.info("=" * 80)
        logger.info("🔍 CHECKING MATCHING LOGIC")
        logger.info("=" * 80)
        
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # Check how records should match
            logger.info("\n📊 Checking matching criteria:")
            logger.info("-" * 80)
            logger.info("   Matching should be: zomato.order_id = orders.instance_id")
            logger.info("   AND zomato.store_code = orders.store_name")
            
            # Check sample data
            logger.info("\n📊 Sample POS records in summary:")
            pos_sample_query = text("""
                SELECT 
                    id,
                    pos_order_id,
                    store_name,
                    order_date,
                    pos_net_amount
                FROM zomato_vs_pos_summary
                WHERE pos_order_id IS NOT NULL
                LIMIT 5
            """)
            result = await db.execute(pos_sample_query)
            pos_samples = result.fetchall()
            for row in pos_samples:
                logger.info(f"   ID: {row[0]}, POS Order ID: {row[1]}, Store: {row[2]}, Date: {row[3]}, Amount: {row[4]}")
            
            logger.info("\n📊 Sample Zomato records in summary:")
            zomato_sample_query = text("""
                SELECT 
                    id,
                    zomato_order_id,
                    store_name,
                    order_date,
                    zomato_net_amount
                FROM zomato_vs_pos_summary
                WHERE zomato_order_id IS NOT NULL
                LIMIT 5
            """)
            result = await db.execute(zomato_sample_query)
            zomato_samples = result.fetchall()
            for row in zomato_samples:
                logger.info(f"   ID: {row[0]}, Zomato Order ID: {row[1]}, Store: {row[2]}, Date: {row[3]}, Amount: {row[4]}")
            
            # Check if they should match
            logger.info("\n📊 Checking if POS and Zomato records should match:")
            logger.info("-" * 80)
            match_check_query = text("""
                SELECT 
                    zvs1.pos_order_id,
                    zvs1.store_name as pos_store,
                    zvs1.order_date as pos_date,
                    zvs2.zomato_order_id,
                    zvs2.store_name as zomato_store,
                    zvs2.order_date as zomato_date
                FROM zomato_vs_pos_summary zvs1
                INNER JOIN zomato_vs_pos_summary zvs2
                    ON zvs1.pos_order_id = zvs2.zomato_order_id
                    AND zvs1.store_name = zvs2.store_name
                LIMIT 10
            """)
            result = await db.execute(match_check_query)
            matches = result.fetchall()
            logger.info(f"   Found {len(matches)} potential matches")
            for row in matches[:5]:
                logger.info(f"   POS Order: {row[0]}, Zomato Order: {row[3]}, Store: {row[1]}")
            
            # Check orders table to see what we inserted
            logger.info("\n📊 Sample orders we inserted:")
            orders_sample_query = text("""
                SELECT 
                    instance_id,
                    store_name,
                    date,
                    net_sale,
                    payment
                FROM orders
                WHERE online_order_taker = 'ZOMATO'
                    AND instance_id NOT IN (
                        SELECT pos_order_id FROM zomato_vs_pos_summary WHERE pos_order_id IS NOT NULL
                    )
                LIMIT 5
            """)
            result = await db.execute(orders_sample_query)
            orders_samples = result.fetchall()
            for row in orders_samples:
                logger.info(f"   Instance ID: {row[0]}, Store: {row[1]}, Date: {row[2]}, Net: {row[3]}, Payment: {row[4]}")
            
            # Check zomato table for matching
            logger.info("\n📊 Checking zomato table for matching orders:")
            zomato_match_query = text("""
                SELECT 
                    z.order_id,
                    z.store_code,
                    z.order_date,
                    z.net_amount
                FROM zomato z
                WHERE z.action IN ('sale', 'addition')
                    AND z.order_id IN (
                        SELECT instance_id FROM orders WHERE online_order_taker = 'ZOMATO'
                    )
                LIMIT 5
            """)
            result = await db.execute(zomato_match_query)
            zomato_matches = result.fetchall()
            logger.info(f"   Found {len(zomato_matches)} zomato records that match orders")
            for row in zomato_matches:
                logger.info(f"   Order ID: {row[0]}, Store: {row[1]}, Date: {row[2]}, Amount: {row[3]}")
            
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(check_matching())


