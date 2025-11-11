"""
Script to investigate why zomato_pos_vs_3po_data has only 25 records instead of 96
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.config.database import create_engines

async def investigate():
    """Investigate the data discrepancy"""
    print("\n" + "="*80)
    print("INVESTIGATING ZOMATO DATA DISCREPANCY")
    print("="*80)
    
    try:
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # 1. Check zomato_vs_pos_summary table counts
            print("\n1. Checking zomato_vs_pos_summary table:")
            print("-" * 80)
            
            # Total records
            total_query = text("SELECT COUNT(*) as count FROM zomato_vs_pos_summary")
            total_result = await db.execute(total_query)
            total_count = total_result.scalar()
            print(f"   Total records in zomato_vs_pos_summary: {total_count}")
            
            # Records with pos_order_id IS NOT NULL (should go to zomato_pos_vs_3po_data)
            pos_not_null_query = text("""
                SELECT COUNT(*) as count 
                FROM zomato_vs_pos_summary 
                WHERE pos_order_id IS NOT NULL
            """)
            pos_not_null_result = await db.execute(pos_not_null_query)
            pos_not_null_count = pos_not_null_result.scalar()
            print(f"   Records with pos_order_id IS NOT NULL: {pos_not_null_count}")
            print(f"   (These should be in zomato_pos_vs_3po_data)")
            
            # Records with pos_order_id IS NULL and zomato_order_id IS NOT NULL (should go to orders_not_in_pos_data)
            pos_null_query = text("""
                SELECT COUNT(*) as count 
                FROM zomato_vs_pos_summary 
                WHERE pos_order_id IS NULL 
                AND zomato_order_id IS NOT NULL
            """)
            pos_null_result = await db.execute(pos_null_query)
            pos_null_count = pos_null_result.scalar()
            print(f"   Records with pos_order_id IS NULL and zomato_order_id IS NOT NULL: {pos_null_count}")
            print(f"   (These should be in orders_not_in_pos_data)")
            
            # 2. Check actual counts in sheet data tables
            print("\n2. Checking actual counts in sheet data tables:")
            print("-" * 80)
            
            zomato_pos_vs_3po_query = text("SELECT COUNT(*) as count FROM zomato_pos_vs_3po_data")
            zomato_pos_vs_3po_result = await db.execute(zomato_pos_vs_3po_query)
            zomato_pos_vs_3po_count = zomato_pos_vs_3po_result.scalar()
            print(f"   zomato_pos_vs_3po_data: {zomato_pos_vs_3po_count} records")
            
            orders_not_in_pos_query = text("SELECT COUNT(*) as count FROM orders_not_in_pos_data")
            orders_not_in_pos_result = await db.execute(orders_not_in_pos_query)
            orders_not_in_pos_count = orders_not_in_pos_result.scalar()
            print(f"   orders_not_in_pos_data: {orders_not_in_pos_count} records")
            
            # 3. Compare expected vs actual
            print("\n3. Comparison:")
            print("-" * 80)
            print(f"   Expected in zomato_pos_vs_3po_data: {pos_not_null_count}")
            print(f"   Actual in zomato_pos_vs_3po_data: {zomato_pos_vs_3po_count}")
            if pos_not_null_count == zomato_pos_vs_3po_count:
                print(f"   ✅ MATCH!")
            else:
                print(f"   ⚠️  MISMATCH: Missing {pos_not_null_count - zomato_pos_vs_3po_count} records")
            
            print(f"\n   Expected in orders_not_in_pos_data: {pos_null_count}")
            print(f"   Actual in orders_not_in_pos_data: {orders_not_in_pos_count}")
            if pos_null_count == orders_not_in_pos_count:
                print(f"   ✅ MATCH!")
            else:
                print(f"   ⚠️  MISMATCH: Missing {pos_null_count - orders_not_in_pos_count} records")
            
            # 4. Check date range in zomato_vs_pos_summary
            print("\n4. Checking date range in zomato_vs_pos_summary:")
            print("-" * 80)
            date_range_query = text("""
                SELECT 
                    MIN(order_date) as min_date,
                    MAX(order_date) as max_date,
                    COUNT(*) as count
                FROM zomato_vs_pos_summary
            """)
            date_range_result = await db.execute(date_range_query)
            date_range_row = date_range_result.first()
            if date_range_row:
                print(f"   Date range: {date_range_row.min_date} to {date_range_row.max_date}")
                print(f"   Total records: {date_range_row.count}")
            
            # 5. Check date range for records with pos_order_id IS NOT NULL
            print("\n5. Date range for records with pos_order_id IS NOT NULL:")
            print("-" * 80)
            pos_date_query = text("""
                SELECT 
                    MIN(order_date) as min_date,
                    MAX(order_date) as max_date,
                    COUNT(*) as count
                FROM zomato_vs_pos_summary
                WHERE pos_order_id IS NOT NULL
            """)
            pos_date_result = await db.execute(pos_date_query)
            pos_date_row = pos_date_result.first()
            if pos_date_row:
                print(f"   Date range: {pos_date_row.min_date} to {pos_date_row.max_date}")
                print(f"   Total records: {pos_date_row.count}")
            
            # 6. Sample records from zomato_vs_pos_summary with pos_order_id IS NOT NULL
            print("\n6. Sample records from zomato_vs_pos_summary (pos_order_id IS NOT NULL):")
            print("-" * 80)
            sample_query = text("""
                SELECT 
                    id, zomato_order_id, pos_order_id, order_date, store_name,
                    pos_net_amount, zomato_net_amount
                FROM zomato_vs_pos_summary
                WHERE pos_order_id IS NOT NULL
                LIMIT 10
            """)
            sample_result = await db.execute(sample_query)
            for row in sample_result:
                print(f"   ID: {row.id}, Zomato: {row.zomato_order_id}, POS: {row.pos_order_id}, Date: {row.order_date}, Store: {row.store_name}")
            
            # 7. Check if there are any records in zomato_pos_vs_3po_data that don't match zomato_vs_pos_summary
            print("\n7. Checking for orphaned records:")
            print("-" * 80)
            orphan_query = text("""
                SELECT COUNT(*) as count
                FROM zomato_pos_vs_3po_data z
                LEFT JOIN zomato_vs_pos_summary s ON z.pos_order_id = s.pos_order_id
                WHERE s.pos_order_id IS NULL
            """)
            orphan_result = await db.execute(orphan_query)
            orphan_count = orphan_result.scalar()
            print(f"   Orphaned records in zomato_pos_vs_3po_data: {orphan_count}")
            
            # 8. Check for records in zomato_vs_pos_summary that should be in zomato_pos_vs_3po_data but aren't
            print("\n8. Checking for missing records:")
            print("-" * 80)
            missing_query = text("""
                SELECT COUNT(*) as count
                FROM zomato_vs_pos_summary s
                LEFT JOIN zomato_pos_vs_3po_data z ON s.pos_order_id = z.pos_order_id
                WHERE s.pos_order_id IS NOT NULL
                AND z.pos_order_id IS NULL
            """)
            missing_result = await db.execute(missing_query)
            missing_count = missing_result.scalar()
            print(f"   Records in zomato_vs_pos_summary that should be in zomato_pos_vs_3po_data but aren't: {missing_count}")
            
            if missing_count > 0:
                print("\n   ⚠️  ISSUE FOUND: There are records in zomato_vs_pos_summary that haven't been inserted into zomato_pos_vs_3po_data!")
                print("\n   Sample missing records:")
                missing_sample_query = text("""
                    SELECT 
                        s.id, s.zomato_order_id, s.pos_order_id, s.order_date, s.store_name
                    FROM zomato_vs_pos_summary s
                    LEFT JOIN zomato_pos_vs_3po_data z ON s.pos_order_id = z.pos_order_id
                    WHERE s.pos_order_id IS NOT NULL
                    AND z.pos_order_id IS NULL
                    LIMIT 5
                """)
                missing_sample_result = await db.execute(missing_sample_query)
                for row in missing_sample_result:
                    print(f"   ID: {row.id}, Zomato: {row.zomato_order_id}, POS: {row.pos_order_id}, Date: {row.order_date}, Store: {row.store_name}")
            
            print("\n" + "="*80)
            print("INVESTIGATION COMPLETE")
            print("="*80)
            
    except Exception as e:
        print(f"\n❌ Error during investigation: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(investigate())

