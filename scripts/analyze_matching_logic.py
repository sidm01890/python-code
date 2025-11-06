"""
Script to analyze why only 25 Zomato orders have POS matches
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.config.database import create_engines

async def analyze_matching():
    """Analyze the matching logic"""
    print("\n" + "="*80)
    print("ANALYZING MATCHING LOGIC: Why only 25 Zomato orders have POS matches?")
    print("="*80)
    
    try:
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # 1. Check total Zomato orders
            print("\n1. Checking Zomato orders:")
            print("-" * 80)
            zomato_query = text("""
                SELECT COUNT(*) as count
                FROM zomato
                WHERE action IN ('sale', 'addition')
            """)
            zomato_result = await db.execute(zomato_query)
            zomato_count = zomato_result.scalar()
            print(f"   Total Zomato orders (sale/addition): {zomato_count}")
            
            # 2. Check total POS orders
            print("\n2. Checking POS orders:")
            print("-" * 80)
            pos_query = text("""
                SELECT COUNT(*) as count
                FROM orders
                WHERE online_order_taker = 'ZOMATO'
            """)
            pos_result = await db.execute(pos_query)
            pos_count = pos_result.scalar()
            print(f"   Total POS orders (online_order_taker = 'ZOMATO'): {pos_count}")
            
            # 3. Check matching logic: zomato.order_id == orders.instance_id
            print("\n3. Analyzing matching logic:")
            print("-" * 80)
            print("   Matching Rule: zomato.order_id == orders.instance_id")
            print("   AND zomato.store_code == orders.store_name")
            
            # Direct match check
            direct_match_query = text("""
                SELECT COUNT(DISTINCT z.order_id) as count
                FROM zomato z
                INNER JOIN orders o ON z.order_id = o.instance_id
                WHERE z.action IN ('sale', 'addition')
                AND o.online_order_taker = 'ZOMATO'
            """)
            direct_match_result = await db.execute(direct_match_query)
            direct_match_count = direct_match_result.scalar()
            print(f"\n   Direct matches (zomato.order_id = orders.instance_id): {direct_match_count}")
            
            # Match with store code
            match_with_store_query = text("""
                SELECT COUNT(DISTINCT z.order_id) as count
                FROM zomato z
                INNER JOIN orders o ON z.order_id = o.instance_id 
                    AND z.store_code = o.store_name
                WHERE z.action IN ('sale', 'addition')
                AND o.online_order_taker = 'ZOMATO'
            """)
            match_with_store_result = await db.execute(match_with_store_query)
            match_with_store_count = match_with_store_result.scalar()
            print(f"   Matches with store code check: {match_with_store_count}")
            
            # 4. Check what's in zomato_vs_pos_summary
            print("\n4. Checking zomato_vs_pos_summary table:")
            print("-" * 80)
            summary_query = text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(DISTINCT zomato_order_id) as distinct_zomato,
                    COUNT(DISTINCT pos_order_id) as distinct_pos,
                    SUM(CASE WHEN pos_order_id IS NOT NULL THEN 1 ELSE 0 END) as with_pos_match,
                    SUM(CASE WHEN pos_order_id IS NULL AND zomato_order_id IS NOT NULL THEN 1 ELSE 0 END) as without_pos_match
                FROM zomato_vs_pos_summary
            """)
            summary_result = await db.execute(summary_query)
            summary_row = summary_result.first()
            if summary_row:
                print(f"   Total records: {summary_row.total}")
                print(f"   Distinct Zomato orders: {summary_row.distinct_zomato}")
                print(f"   Distinct POS orders: {summary_row.distinct_pos}")
                print(f"   Records with POS match: {summary_row.with_pos_match}")
                print(f"   Records without POS match: {summary_row.without_pos_match}")
            
            # 5. Find Zomato orders that should match but don't
            print("\n5. Finding Zomato orders that should match but don't:")
            print("-" * 80)
            unmatched_query = text("""
                SELECT 
                    z.order_id as zomato_order_id,
                    z.store_code as zomato_store,
                    z.order_date as zomato_date,
                    o.instance_id as pos_instance_id,
                    o.store_name as pos_store,
                    o.date as pos_date
                FROM zomato z
                LEFT JOIN orders o ON z.order_id = o.instance_id 
                    AND o.online_order_taker = 'ZOMATO'
                WHERE z.action IN ('sale', 'addition')
                AND o.instance_id IS NULL
                LIMIT 10
            """)
            unmatched_result = await db.execute(unmatched_query)
            unmatched_count = 0
            print("\n   Sample Zomato orders without direct POS match:")
            for row in unmatched_result:
                unmatched_count += 1
                print(f"   Zomato Order: {row.zomato_order_id}, Store: {row.zomato_store}, Date: {row.zomato_date}")
            
            # 6. Check if there are POS orders with same instance_id but different store
            print("\n6. Checking for store mismatches:")
            print("-" * 80)
            store_mismatch_query = text("""
                SELECT 
                    z.order_id as zomato_order_id,
                    z.store_code as zomato_store,
                    o.instance_id as pos_instance_id,
                    o.store_name as pos_store
                FROM zomato z
                INNER JOIN orders o ON z.order_id = o.instance_id
                WHERE z.action IN ('sale', 'addition')
                AND o.online_order_taker = 'ZOMATO'
                AND z.store_code != o.store_name
                LIMIT 10
            """)
            store_mismatch_result = await db.execute(store_mismatch_query)
            store_mismatches = list(store_mismatch_result)
            print(f"   Store mismatches (order_id matches but store doesn't): {len(store_mismatches)}")
            if store_mismatches:
                print("\n   Sample store mismatches:")
                for row in store_mismatches:
                    print(f"   Order ID: {row.zomato_order_id}, Zomato Store: {row.zomato_store}, POS Store: {row.pos_store}")
            
            # 7. Check date ranges
            print("\n7. Checking date ranges:")
            print("-" * 80)
            zomato_date_query = text("""
                SELECT 
                    MIN(order_date) as min_date,
                    MAX(order_date) as max_date,
                    COUNT(*) as count
                FROM zomato
                WHERE action IN ('sale', 'addition')
            """)
            zomato_date_result = await db.execute(zomato_date_query)
            zomato_date_row = zomato_date_result.first()
            if zomato_date_row:
                print(f"   Zomato orders date range: {zomato_date_row.min_date} to {zomato_date_row.max_date}")
                print(f"   Total: {zomato_date_row.count}")
            
            pos_date_query = text("""
                SELECT 
                    MIN(date) as min_date,
                    MAX(date) as max_date,
                    COUNT(*) as count
                FROM orders
                WHERE online_order_taker = 'ZOMATO'
            """)
            pos_date_result = await db.execute(pos_date_query)
            pos_date_row = pos_date_result.first()
            if pos_date_row:
                print(f"   POS orders date range: {pos_date_row.min_date} to {pos_date_row.max_date}")
                print(f"   Total: {pos_date_row.count}")
            
            # 8. Check for potential matches by date and store
            print("\n8. Potential matches by date and store (same date, same store, different order_id):")
            print("-" * 80)
            potential_match_query = text("""
                SELECT 
                    z.order_id as zomato_order_id,
                    z.store_code,
                    z.order_date,
                    COUNT(DISTINCT o.instance_id) as potential_pos_matches
                FROM zomato z
                LEFT JOIN orders o ON z.store_code = o.store_name
                    AND z.order_date = o.date
                    AND o.online_order_taker = 'ZOMATO'
                    AND z.order_id != o.instance_id
                WHERE z.action IN ('sale', 'addition')
                GROUP BY z.order_id, z.store_code, z.order_date
                HAVING potential_pos_matches > 0
                LIMIT 10
            """)
            potential_match_result = await db.execute(potential_match_query)
            potential_matches = list(potential_match_result)
            print(f"   Zomato orders with potential matches (same date/store, different ID): {len(potential_matches)}")
            if potential_matches:
                print("\n   Sample potential matches:")
                for row in potential_matches:
                    print(f"   Zomato Order: {row.zomato_order_id}, Store: {row.store_code}, Date: {row.order_date}, Potential POS matches: {row.potential_pos_matches}")
            
            # 9. Summary
            print("\n" + "="*80)
            print("SUMMARY")
            print("="*80)
            print(f"Total Zomato orders: {zomato_count}")
            print(f"Total POS orders: {pos_count}")
            print(f"Direct matches (order_id = instance_id): {direct_match_count}")
            print(f"Matches in zomato_vs_pos_summary: {summary_row.with_pos_match if summary_row else 'N/A'}")
            print(f"\nConclusion:")
            if direct_match_count == (summary_row.with_pos_match if summary_row else 0):
                print("✅ Matching logic is working correctly!")
                print(f"   Only {direct_match_count} Zomato orders have matching POS orders by order_id.")
            else:
                print(f"⚠️  Discrepancy found!")
                print(f"   Direct SQL matches: {direct_match_count}")
                print(f"   Records in summary table: {summary_row.with_pos_match if summary_row else 'N/A'}")
            
            print("\n" + "="*80)
            
    except Exception as e:
        print(f"\n❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(analyze_matching())


