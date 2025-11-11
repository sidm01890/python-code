"""
Script to fix data issues and regenerate reconciliation summary tables
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


async def fix_orders_data():
    """Fix orders data that was inserted from zomato"""
    try:
        logger.info("=" * 80)
        logger.info("🔧 FIXING ORDERS DATA")
        logger.info("=" * 80)
        
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # Check orders that were inserted but might have missing payment field
            logger.info("\n📊 Checking orders with missing payment field...")
            check_query = text("""
                SELECT 
                    COUNT(*) as missing_payment_count
                FROM orders o
                WHERE o.online_order_taker = 'ZOMATO'
                    AND o.payment IS NULL
                    AND o.net_sale IS NOT NULL
            """)
            result = await db.execute(check_query)
            missing_payment = result.scalar()
            logger.info(f"   Orders with NULL payment but has net_sale: {missing_payment}")
            
            if missing_payment > 0:
                logger.info("\n🔧 Fixing payment field for orders...")
                # Update payment field from net_sale or gross_amount
                fix_query = text("""
                    UPDATE orders
                    SET payment = COALESCE(net_sale, gross_amount, 0)
                    WHERE online_order_taker = 'ZOMATO'
                        AND payment IS NULL
                        AND (net_sale IS NOT NULL OR gross_amount IS NOT NULL)
                """)
                result = await db.execute(fix_query)
                await db.commit()
                updated = result.rowcount if hasattr(result, 'rowcount') else 0
                logger.info(f"   ✅ Updated {updated} orders with payment field")
            
            # Verify fix
            verify_query = text("""
                SELECT 
                    COUNT(*) as total_zomato_orders,
                    COUNT(CASE WHEN payment IS NOT NULL THEN 1 END) as with_payment,
                    COUNT(CASE WHEN payment IS NULL THEN 1 END) as without_payment,
                    COUNT(CASE WHEN store_name IS NOT NULL THEN 1 END) as with_store_name,
                    COUNT(CASE WHEN instance_id IS NOT NULL THEN 1 END) as with_instance_id
                FROM orders
                WHERE online_order_taker = 'ZOMATO'
            """)
            result = await db.execute(verify_query)
            stats = result.fetchone()
            logger.info(f"\n✅ Verification:")
            logger.info(f"   Total ZOMATO orders: {stats[0]}")
            logger.info(f"   With payment: {stats[1]}")
            logger.info(f"   Without payment: {stats[2]}")
            logger.info(f"   With store_name: {stats[3]}")
            logger.info(f"   With instance_id: {stats[4]}")
            
    except Exception as e:
        logger.error(f"❌ Error fixing orders: {e}", exc_info=True)
        raise


async def verify_summary_table():
    """Verify the summary table status"""
    try:
        logger.info("\n" + "=" * 80)
        logger.info("🔍 VERIFYING SUMMARY TABLE")
        logger.info("=" * 80)
        
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # Check summary table
            summary_query = text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL THEN 1 END) as with_pos,
                    COUNT(CASE WHEN zomato_order_id IS NOT NULL THEN 1 END) as with_zomato,
                    COUNT(CASE WHEN pos_order_id IS NOT NULL AND zomato_order_id IS NOT NULL THEN 1 END) as matched,
                    SUM(CASE WHEN pos_order_id IS NOT NULL THEN COALESCE(pos_net_amount, 0) ELSE 0 END) as pos_total,
                    SUM(CASE WHEN zomato_order_id IS NOT NULL THEN COALESCE(zomato_net_amount, 0) ELSE 0 END) as zomato_total
                FROM zomato_vs_pos_summary
            """)
            result = await db.execute(summary_query)
            stats = result.fetchone()
            logger.info(f"   Total records: {stats[0]}")
            logger.info(f"   With POS order ID: {stats[1]}")
            logger.info(f"   With Zomato order ID: {stats[2]}")
            logger.info(f"   Matched (both): {stats[3]}")
            logger.info(f"   POS total amount: {stats[4]}")
            logger.info(f"   Zomato total amount: {stats[5]}")
            
            # Check what's missing
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
            
            logger.info(f"\n⚠️  Missing from summary:")
            logger.info(f"   Orders not in summary: {missing_pos}")
            logger.info(f"   Zomato records not in summary: {missing_zomato}")
            
            if missing_pos > 0 or missing_zomato > 0:
                logger.warning("\n⚠️  ACTION REQUIRED:")
                logger.warning("   Call GET /api/reconciliation/populate-threepo-dashboard")
                logger.warning("   to regenerate the summary table")
            
    except Exception as e:
        logger.error(f"❌ Error verifying summary: {e}", exc_info=True)
        raise


async def main():
    """Main function"""
    try:
        # Step 1: Fix orders data
        await fix_orders_data()
        
        # Step 2: Verify summary table
        await verify_summary_table()
        
        logger.info("\n" + "=" * 80)
        logger.info("✅ VERIFICATION COMPLETE")
        logger.info("=" * 80)
        logger.info("\n📋 NEXT STEPS:")
        logger.info("   1. Call GET /api/reconciliation/populate-threepo-dashboard")
        logger.info("   2. This will regenerate zomato_vs_pos_summary table")
        logger.info("   3. Then regenerate the Excel report")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())


