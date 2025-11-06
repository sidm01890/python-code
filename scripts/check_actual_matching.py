"""
Script to check how the matching actually works
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.config.database import create_engines

async def check_actual_matching():
    """Check how matching actually works"""
    print("\n" + "="*80)
    print("CHECKING ACTUAL MATCHING MECHANISM")
    print("="*80)
    
    try:
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # Check how records are matched in zomato_vs_pos_summary
            print("\n1. Sample matched records (with both pos_order_id and zomato_order_id):")
            print("-" * 80)
            matched_query = text("""
                SELECT 
                    id,
                    zomato_order_id,
                    pos_order_id,
                    store_name,
                    order_date
                FROM zomato_vs_pos_summary
                WHERE pos_order_id IS NOT NULL
                AND zomato_order_id IS NOT NULL
                LIMIT 10
            """)
            matched_result = await db.execute(matched_query)
            for row in matched_result:
                print(f"   ID: {row.id}")
                print(f"   Zomato Order ID: {row.zomato_order_id}")
                print(f"   POS Order ID: {row.pos_order_id}")
                print(f"   Store: {row.store_name}, Date: {row.order_date}")
                print()
            
            # Check if zomato.order_id matches any orders.instance_id
            print("\n2. Checking if Zomato order IDs match POS instance IDs:")
            print("-" * 80)
            check_match_query = text("""
                SELECT 
                    z.order_id as zomato_order_id,
                    o.instance_id as pos_instance_id,
                    z.store_code as zomato_store,
                    o.store_name as pos_store
                FROM zomato z
                INNER JOIN orders o ON z.order_id = o.instance_id
                WHERE z.action IN ('sale', 'addition')
                AND o.online_order_taker = 'ZOMATO'
                LIMIT 10
            """)
            check_match_result = await db.execute(check_match_query)
            matches = list(check_match_result)
            if matches:
                print(f"   Found {len(matches)} direct matches:")
                for row in matches:
                    print(f"   Zomato: {row.zomato_order_id} = POS: {row.pos_instance_id}")
                    print(f"   Stores - Zomato: {row.zomato_store}, POS: {row.pos_store}")
            else:
                print("   ❌ NO DIRECT MATCHES FOUND!")
                print("   This means zomato.order_id does NOT equal orders.instance_id")
            
            # Check what POS instance_ids are in the matched records
            print("\n3. POS instance_ids that are matched:")
            print("-" * 80)
            pos_matched_query = text("""
                SELECT DISTINCT pos_order_id
                FROM zomato_vs_pos_summary
                WHERE pos_order_id IS NOT NULL
                LIMIT 10
            """)
            pos_matched_result = await db.execute(pos_matched_query)
            pos_ids = [row.pos_order_id for row in pos_matched_result]
            print(f"   Sample POS Order IDs in summary: {pos_ids[:5]}")
            
            # Check what Zomato order_ids are matched
            print("\n4. Zomato order_ids that are matched:")
            print("-" * 80)
            zomato_matched_query = text("""
                SELECT DISTINCT zomato_order_id
                FROM zomato_vs_pos_summary
                WHERE zomato_order_id IS NOT NULL
                AND pos_order_id IS NOT NULL
                LIMIT 10
            """)
            zomato_matched_result = await db.execute(zomato_matched_query)
            zomato_ids = [row.zomato_order_id for row in zomato_matched_result]
            print(f"   Sample Zomato Order IDs in summary: {zomato_ids[:5]}")
            
            # Check if these Zomato IDs exist in zomato table
            print("\n5. Verifying matched Zomato IDs exist in zomato table:")
            print("-" * 80)
            if zomato_ids:
                placeholders = ",".join([f":id_{i}" for i in range(len(zomato_ids[:5]))])
                verify_query = text(f"""
                    SELECT order_id, store_code, order_date
                    FROM zomato
                    WHERE order_id IN ({placeholders})
                    AND action IN ('sale', 'addition')
                """)
                params = {f"id_{i}": zomato_ids[i] for i in range(min(5, len(zomato_ids)))}
                verify_result = await db.execute(verify_query, params)
                for row in verify_result:
                    print(f"   ✅ Found: {row.order_id}, Store: {row.store_code}, Date: {row.order_date}")
            
            # Check if these POS IDs exist in orders table
            print("\n6. Verifying matched POS IDs exist in orders table:")
            print("-" * 80)
            if pos_ids:
                placeholders = ",".join([f":id_{i}" for i in range(len(pos_ids[:5]))])
                verify_pos_query = text(f"""
                    SELECT instance_id, store_name, date
                    FROM orders
                    WHERE instance_id IN ({placeholders})
                    AND online_order_taker = 'ZOMATO'
                """)
                params = {f"id_{i}": str(pos_ids[i]) for i in range(min(5, len(pos_ids)))}
                verify_pos_result = await db.execute(verify_pos_query, params)
                for row in verify_pos_result:
                    print(f"   ✅ Found: {row.instance_id}, Store: {row.store_name}, Date: {row.date}")
            
            # Check the actual matching pattern
            print("\n7. Checking matching pattern:")
            print("-" * 80)
            pattern_query = text("""
                SELECT 
                    s.zomato_order_id,
                    s.pos_order_id,
                    s.store_name,
                    s.order_date,
                    z.store_code as zomato_store,
                    o.store_name as pos_store,
                    CASE 
                        WHEN s.zomato_order_id = s.pos_order_id THEN 'SAME_ID'
                        WHEN s.store_name = z.store_code AND s.store_name = o.store_name THEN 'SAME_STORE'
                        ELSE 'OTHER'
                    END as match_type
                FROM zomato_vs_pos_summary s
                LEFT JOIN zomato z ON s.zomato_order_id = z.order_id
                LEFT JOIN orders o ON s.pos_order_id = o.instance_id
                WHERE s.pos_order_id IS NOT NULL
                AND s.zomato_order_id IS NOT NULL
                LIMIT 10
            """)
            pattern_result = await db.execute(pattern_query)
            for row in pattern_result:
                print(f"   Zomato: {row.zomato_order_id}, POS: {row.pos_order_id}")
                print(f"   Match Type: {row.match_type}")
                print(f"   Stores - Summary: {row.store_name}, Zomato: {row.zomato_store}, POS: {row.pos_store}")
                print()
            
            print("="*80)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_actual_matching())


