#!/usr/bin/env python3
"""
Script to verify data in orders table and zomato-related tables
for the date range and store specified in the API logs
"""

import asyncio
import sys
import os
from datetime import datetime
from sqlalchemy.sql import text
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config.database import get_main_db, create_engines

# Configuration from logs
START_DATE = "2024-12-01 00:00:00"
END_DATE = "2024-12-07 23:59:59"
STORE_NAME = "141"

async def verify_orders_table(db: AsyncSession):
    """Verify data in orders table"""
    print("\n" + "="*80)
    print("📊 VERIFYING ORDERS TABLE")
    print("="*80)
    
    # Query 1: Count total orders in date range - Check all date columns
    print(f"\n🔍 Checking all date columns in orders table:")
    
    # Check 'date' column (used in API queries)
    count_query_date = text("""
        SELECT COUNT(*) as total_count
        FROM orders
        WHERE date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
    """)
    
    result = await db.execute(count_query_date, {
        "start_date": START_DATE,
        "end_date": END_DATE,
        "store_name": STORE_NAME
    })
    count_row = result.first()
    total_count_date = count_row.total_count if count_row else 0
    print(f"   📅 Using 'date' column: {total_count_date} records")
    
    # Check 'business_date' column
    count_query_business = text("""
        SELECT COUNT(*) as total_count
        FROM orders
        WHERE business_date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
    """)
    
    result = await db.execute(count_query_business, {
        "start_date": START_DATE,
        "end_date": END_DATE,
        "store_name": STORE_NAME
    })
    count_row = result.first()
    total_count_business = count_row.total_count if count_row else 0
    print(f"   📅 Using 'business_date' column: {total_count_business} records")
    
    # Check 'original_date' column
    count_query_original = text("""
        SELECT COUNT(*) as total_count
        FROM orders
        WHERE original_date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
    """)
    
    result = await db.execute(count_query_original, {
        "start_date": START_DATE,
        "end_date": END_DATE,
        "store_name": STORE_NAME
    })
    count_row = result.first()
    total_count_original = count_row.total_count if count_row else 0
    print(f"   📅 Using 'original_date' column: {total_count_original} records")
    
    # Check if any records exist for this store at all
    any_date_query = text("""
        SELECT COUNT(*) as total_count
        FROM orders
        WHERE store_name = :store_name
        AND (
            (date BETWEEN :start_date AND :end_date)
            OR (business_date BETWEEN :start_date AND :end_date)
            OR (original_date BETWEEN :start_date AND :end_date)
        )
    """)
    
    result = await db.execute(any_date_query, {
        "start_date": START_DATE,
        "end_date": END_DATE,
        "store_name": STORE_NAME
    })
    count_row = result.first()
    total_count_any = count_row.total_count if count_row else 0
    print(f"   📅 Using ANY date column: {total_count_any} records")
    
    total_count = total_count_date  # Keep for backward compatibility
    
    # Query 2: Check distinct online_order_taker values (using 'date' column as per API)
    tender_query = text("""
        SELECT DISTINCT UPPER(TRIM(online_order_taker)) AS tender, COUNT(*) as count
        FROM orders
        WHERE date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
        GROUP BY UPPER(TRIM(online_order_taker))
        ORDER BY count DESC
        LIMIT 20
    """)
    
    result = await db.execute(tender_query, {
        "start_date": START_DATE,
        "end_date": END_DATE,
        "store_name": STORE_NAME
    })
    tender_rows = result.fetchall()
    
    print(f"\n📋 Distinct online_order_taker values:")
    for row in tender_rows:
        print(f"   - {row.tender}: {row.count} orders")
    
    # Query 3: Check CARD/UPI orders specifically
    card_upi_query = text("""
        SELECT COUNT(*) as total_count,
               SUM(CAST(COALESCE(payment, 0) AS DECIMAL(15,2))) as total_payment
        FROM orders
        WHERE date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
        AND (
            UPPER(TRIM(online_order_taker)) = 'CARD'
            OR UPPER(TRIM(online_order_taker)) = 'UPI'
        )
    """)
    
    result = await db.execute(card_upi_query, {
        "start_date": START_DATE,
        "end_date": END_DATE,
        "store_name": STORE_NAME
    })
    card_upi_row = result.first()
    print(f"\n💳 CARD/UPI Orders:")
    print(f"   - Count: {card_upi_row.total_count if card_upi_row else 0}")
    print(f"   - Total Payment: {float(card_upi_row.total_payment or 0) if card_upi_row else 0}")
    
    # Query 4: Sample records with all relevant columns (including all date columns)
    sample_query = text("""
        SELECT 
            id,
            date,
            business_date,
            original_date,
            store_name,
            online_order_taker,
            payment,
            bill_number,
            channel,
            settlement_mode,
            subtotal,
            discount,
            net_sale,
            gross_amount
        FROM orders
        WHERE date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
        AND (
            UPPER(TRIM(online_order_taker)) = 'CARD'
            OR UPPER(TRIM(online_order_taker)) = 'UPI'
            OR UPPER(TRIM(online_order_taker)) = 'ZOMATO'
        )
        ORDER BY date DESC
        LIMIT 10
    """)
    
    result = await db.execute(sample_query, {
        "start_date": START_DATE,
        "end_date": END_DATE,
        "store_name": STORE_NAME
    })
    sample_rows = result.fetchall()
    
    print(f"\n📄 Sample Records (first 10):")
    if sample_rows:
        print(f"{'ID':<15} {'Date':<12} {'Business Date':<12} {'Original Date':<12} {'Store':<10} {'Taker':<15} {'Payment':<15}")
        print("-" * 100)
        for row in sample_rows:
            print(f"{str(row.id)[:15]:<15} {str(row.date)[:12]:<12} {str(row.business_date)[:12]:<12} "
                  f"{str(row.original_date)[:12]:<12} {str(row.store_name)[:10]:<10} "
                  f"{str(row.online_order_taker)[:15]:<15} {str(row.payment)[:15]:<15}")
    else:
        print("   ⚠️  No records found matching criteria")


async def verify_zomato_table(db: AsyncSession):
    """Verify data in zomato table"""
    print("\n" + "="*80)
    print("📊 VERIFYING ZOMATO TABLE (Raw Data)")
    print("="*80)
    
    # Query 1: Count total zomato orders
    count_query = text("""
        SELECT COUNT(*) as total_count
        FROM zomato
        WHERE order_date BETWEEN :start_date AND :end_date
        AND store_code = :store_name
        AND action IN ('sale', 'addition')
    """)
    
    result = await db.execute(count_query, {
        "start_date": START_DATE.split()[0],  # Just date part
        "end_date": END_DATE.split()[0],  # Just date part
        "store_name": STORE_NAME
    })
    count_row = result.first()
    total_count = count_row.total_count if count_row else 0
    print(f"\n✅ Total zomato orders (sale/addition) in date range: {total_count}")
    
    # Query 2: Sample records with all relevant columns
    sample_query = text("""
        SELECT 
            order_id,
            store_code,
            order_date,
            action,
            bill_subtotal,
            net_amount,
            final_amount,
            tax_paid_by_customer,
            commission_value,
            pg_applied_on,
            pgcharge,
            taxes_zomato_fee,
            tds_amount,
            credit_note_amount,
            pro_discount_passthrough,
            customer_discount,
            rejection_penalty_charge,
            user_credits_charge,
            promo_recovery_adj,
            icecream_handling,
            icecream_deductions,
            order_support_cost,
            merchant_delivery_charge,
            merchant_pack_charge
        FROM zomato
        WHERE order_date BETWEEN :start_date AND :end_date
        AND store_code = :store_name
        AND action IN ('sale', 'addition')
        ORDER BY order_date DESC, order_id DESC
        LIMIT 10
    """)
    
    result = await db.execute(sample_query, {
        "start_date": START_DATE.split()[0],
        "end_date": END_DATE.split()[0],
        "store_name": STORE_NAME
    })
    sample_rows = result.fetchall()
    
    print(f"\n📄 Sample Zomato Records (first 10):")
    if sample_rows:
        print(f"{'Order ID':<20} {'Date':<12} {'Store':<10} {'Net Amt':<12} {'Final Amt':<12} {'Action':<10}")
        print("-" * 90)
        for row in sample_rows:
            print(f"{str(row.order_id)[:20]:<20} {str(row.order_date)[:12]:<12} {str(row.store_code)[:10]:<10} "
                  f"{str(row.net_amount)[:12]:<12} {str(row.final_amount)[:12]:<12} {str(row.action)[:10]:<10}")
        
        # Show detailed first record
        if sample_rows:
            print(f"\n📋 Detailed First Record:")
            first = sample_rows[0]
            print(f"   Order ID: {first.order_id}")
            print(f"   Store Code: {first.store_code}")
            print(f"   Order Date: {first.order_date}")
            print(f"   Action: {first.action}")
            print(f"   Bill Subtotal: {first.bill_subtotal}")
            print(f"   Net Amount: {first.net_amount}")
            print(f"   Final Amount: {first.final_amount}")
            print(f"   Tax Paid by Customer: {first.tax_paid_by_customer}")
            print(f"   Commission Value: {first.commission_value}")
            print(f"   PG Applied On: {first.pg_applied_on}")
            print(f"   PG Charge: {first.pgcharge}")
    else:
        print("   ⚠️  No records found matching criteria")
    
    # Query 3: Summary statistics
    summary_query = text("""
        SELECT 
            COUNT(*) as total_orders,
            SUM(COALESCE(net_amount, 0)) as total_net_amount,
            SUM(COALESCE(final_amount, 0)) as total_final_amount,
            SUM(COALESCE(commission_value, 0)) as total_commission,
            SUM(COALESCE(tax_paid_by_customer, 0)) as total_tax
        FROM zomato
        WHERE order_date BETWEEN :start_date AND :end_date
        AND store_code = :store_name
        AND action IN ('sale', 'addition')
    """)
    
    result = await db.execute(summary_query, {
        "start_date": START_DATE.split()[0],
        "end_date": END_DATE.split()[0],
        "store_name": STORE_NAME
    })
    summary_row = result.first()
    
    if summary_row:
        print(f"\n📊 Zomato Summary Statistics:")
        print(f"   Total Orders: {summary_row.total_orders}")
        print(f"   Total Net Amount: {float(summary_row.total_net_amount or 0)}")
        print(f"   Total Final Amount: {float(summary_row.total_final_amount or 0)}")
        print(f"   Total Commission: {float(summary_row.total_commission or 0)}")
        print(f"   Total Tax: {float(summary_row.total_tax or 0)}")


async def verify_zomato_vs_pos_summary(db: AsyncSession):
    """Verify data in zomato_vs_pos_summary table"""
    print("\n" + "="*80)
    print("📊 VERIFYING ZOMATO_VS_POS_SUMMARY TABLE (Reconciliation Summary)")
    print("="*80)
    
    # Query 1: Count total records
    count_query = text("""
        SELECT COUNT(*) as total_count
        FROM zomato_vs_pos_summary
        WHERE order_date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
    """)
    
    result = await db.execute(count_query, {
        "start_date": START_DATE.split()[0],
        "end_date": END_DATE.split()[0],
        "store_name": STORE_NAME
    })
    count_row = result.first()
    total_count = count_row.total_count if count_row else 0
    print(f"\n✅ Total records in summary table: {total_count}")
    
    # Query 2: Count by order type
    type_query = text("""
        SELECT 
            COUNT(CASE WHEN pos_order_id IS NOT NULL AND pos_net_amount > 0 THEN 1 END) as pos_only,
            COUNT(CASE WHEN zomato_order_id IS NOT NULL AND zomato_net_amount > 0 THEN 1 END) as zomato_only,
            COUNT(CASE WHEN pos_order_id IS NOT NULL AND zomato_order_id IS NOT NULL THEN 1 END) as matched
        FROM zomato_vs_pos_summary
        WHERE order_date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
    """)
    
    result = await db.execute(type_query, {
        "start_date": START_DATE.split()[0],
        "end_date": END_DATE.split()[0],
        "store_name": STORE_NAME
    })
    type_row = result.first()
    
    if type_row:
        print(f"\n📋 Record Types:")
        print(f"   POS Only: {type_row.pos_only}")
        print(f"   Zomato Only: {type_row.zomato_only}")
        print(f"   Matched (Both): {type_row.matched}")
    
    # Query 3: Sample records
    sample_query = text("""
        SELECT 
            id,
            pos_order_id,
            zomato_order_id,
            order_date,
            store_name,
            pos_net_amount,
            zomato_net_amount,
            pos_final_amount,
            zomato_final_amount,
            pos_commission_value,
            zomato_commission_value,
            pos_tax_paid_by_customer,
            zomato_tax_paid_by_customer,
            reconciled_status,
            reconciled_amount,
            unreconciled_amount
        FROM zomato_vs_pos_summary
        WHERE order_date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
        ORDER BY order_date DESC
        LIMIT 10
    """)
    
    result = await db.execute(sample_query, {
        "start_date": START_DATE.split()[0],
        "end_date": END_DATE.split()[0],
        "store_name": STORE_NAME
    })
    sample_rows = result.fetchall()
    
    print(f"\n📄 Sample Summary Records (first 10):")
    if sample_rows:
        print(f"{'POS Order ID':<20} {'Zomato Order ID':<20} {'Date':<12} {'POS Net':<12} {'Zomato Net':<12} {'Status':<15}")
        print("-" * 100)
        for row in sample_rows:
            print(f"{str(row.pos_order_id or 'N/A')[:20]:<20} {str(row.zomato_order_id or 'N/A')[:20]:<20} "
                  f"{str(row.order_date)[:12]:<12} {str(row.pos_net_amount or 0)[:12]:<12} "
                  f"{str(row.zomato_net_amount or 0)[:12]:<12} {str(row.reconciled_status or 'N/A')[:15]:<15}")
        
        # Show detailed first record
        if sample_rows:
            print(f"\n📋 Detailed First Record:")
            first = sample_rows[0]
            print(f"   ID: {first.id}")
            print(f"   POS Order ID: {first.pos_order_id}")
            print(f"   Zomato Order ID: {first.zomato_order_id}")
            print(f"   Order Date: {first.order_date}")
            print(f"   Store Name: {first.store_name}")
            print(f"   POS Net Amount: {first.pos_net_amount}")
            print(f"   Zomato Net Amount: {first.zomato_net_amount}")
            print(f"   POS Final Amount: {first.pos_final_amount}")
            print(f"   Zomato Final Amount: {first.zomato_final_amount}")
            print(f"   POS Commission: {first.pos_commission_value}")
            print(f"   Zomato Commission: {first.zomato_commission_value}")
            print(f"   Reconciled Status: {first.reconciled_status}")
            print(f"   Reconciled Amount: {first.reconciled_amount}")
    else:
        print("   ⚠️  No records found matching criteria")
    
    # Query 4: Summary statistics matching the API query
    summary_query = text("""
        SELECT 
            SUM(CASE WHEN pos_net_amount > 0 THEN pos_net_amount ELSE 0 END) AS posSales,
            SUM(CASE WHEN pos_final_amount > 0 THEN pos_final_amount ELSE 0 END) AS posReceivables,
            SUM(CASE WHEN pos_commission_value > 0 THEN pos_commission_value ELSE 0 END) AS posCommission,
            SUM(CASE WHEN pos_tax_paid_by_customer > 0 THEN pos_tax_paid_by_customer ELSE 0 END) AS posCharges,
            SUM(CASE WHEN zomato_net_amount > 0 THEN zomato_net_amount ELSE 0 END) AS threePOSales,
            SUM(CASE WHEN zomato_final_amount > 0 THEN zomato_final_amount ELSE 0 END) AS threePOReceivables,
            SUM(CASE WHEN zomato_commission_value > 0 THEN zomato_commission_value ELSE 0 END) AS threePOCommission,
            SUM(CASE WHEN zomato_tax_paid_by_customer > 0 THEN zomato_tax_paid_by_customer ELSE 0 END) AS threePOCharges,
            SUM(CASE WHEN reconciled_amount > 0 THEN reconciled_amount ELSE 0 END) AS reconciled
        FROM zomato_vs_pos_summary
        WHERE order_date BETWEEN :start_date AND :end_date
        AND store_name = :store_name
        AND pos_order_id IS NOT NULL
        AND pos_net_amount > 0
    """)
    
    result = await db.execute(summary_query, {
        "start_date": START_DATE.split()[0],
        "end_date": END_DATE.split()[0],
        "store_name": STORE_NAME
    })
    summary_row = result.first()
    
    if summary_row:
        print(f"\n📊 Summary Statistics (POS Perspective):")
        print(f"   POS Sales: {float(summary_row.posSales or 0)}")
        print(f"   POS Receivables: {float(summary_row.posReceivables or 0)}")
        print(f"   POS Commission: {float(summary_row.posCommission or 0)}")
        print(f"   POS Charges: {float(summary_row.posCharges or 0)}")
        print(f"   3PO Sales: {float(summary_row.threePOSales or 0)}")
        print(f"   3PO Receivables: {float(summary_row.threePOReceivables or 0)}")
        print(f"   3PO Commission: {float(summary_row.threePOCommission or 0)}")
        print(f"   3PO Charges: {float(summary_row.threePOCharges or 0)}")
        print(f"   Reconciled: {float(summary_row.reconciled or 0)}")


async def main():
    """Main function"""
    print("\n" + "="*80)
    print("🔍 DATA VERIFICATION SCRIPT")
    print("="*80)
    print(f"\n📅 Date Range: {START_DATE} to {END_DATE}")
    print(f"🏪 Store: {STORE_NAME}")
    print("\n" + "="*80)
    
    # Initialize database engines
    await create_engines()
    
    # Get database session using the dependency
    async for db in get_main_db():
        try:
            # Verify orders table
            await verify_orders_table(db)
            
            # Verify zomato table
            await verify_zomato_table(db)
            
            # Verify zomato_vs_pos_summary table
            await verify_zomato_vs_pos_summary(db)
            
            print("\n" + "="*80)
            print("✅ VERIFICATION COMPLETE")
            print("="*80 + "\n")
            
            # Break after first iteration since we only need one session
            break
            
        except Exception as e:
            print(f"\n❌ Error during verification: {e}")
            import traceback
            traceback.print_exc()
            break


if __name__ == "__main__":
    asyncio.run(main())

