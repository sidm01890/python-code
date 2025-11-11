"""
Script to verify sheet data table counts and test all relevant APIs
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.config.database import create_engines, get_main_db
from app.models.main.sheet_data import ZomatoPosVs3poData, OrdersNotInPosData
import httpx
import json
from datetime import datetime

# Configuration
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8034")
BEARER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDQ1LCJlbWFpbCI6ImphdGluQGNvcmVwZWVsZXJzLmNvbSIsInJvbGUiOjIsIm9yZ2FuaXphdGlvbiI6MTAwMTMsIm5hbWUiOiJVc2VyIiwidXNlcm5hbWUiOiJkZXZ5YW5pX3VzZXIiLCJleHAiOjE3NjIzNDE0NjIsImp0aSI6ImRldnlhbmlfdXNlciJ9.gpRC1AODdSyZiJdYe5GDGcMdpQYybZixFiHvgjAvRQI"

PAYLOAD = {
    "startDate": "2024-12-01 00:00:00",
    "endDate": "2024-12-07 23:59:59",
    "stores": [
        "P755", "237", "026", "20R", "258", "116", "087", "136", "20G", "20T", "P348", "065", "256", "076", "21P", "21G", "235", "234", "059", "P329", "114", "058", "P343", "P688", "248", "085", "P545", "P328", "P711", "P674", "P696", "P744", "P575", "P317", "P346", "P705", "P723", "P706", "P366", "P775", "P825", "P327", "P681", "P382", "P621", "034", "066", "226", "147", "245", "276", "250", "072", "253", "P422", "129", "275", "108", "22B", "P358", "143", "038", "P381", "272", "145", "096", "090", "052", "033", "243", "268", "273", "060", "P462", "P554", "P796", "P830", "233", "201", "P630", "P694", "P718", "P920", "P690", "P572", "P721", "P562", "P598", "P638", "P546", "P849", "P730", "P428", "P661", "P792", "P714", "P573", "P408", "P735", "P476", "P585", "P880", "P207", "P801", "P642", "P852", "P549", "P421", "P574", "P510", "P532", "P409", "P691", "P702", "P908", "P802", "P487", "P611", "P747", "P556", "P850", "P712", "P757", "P846", "P520", "P488", "P841", "P418", "P396", "P639", "P726", "P416", "P623", "P412", "P837", "P664", "P754", "P859", "P693", "P848", "P936", "P657", "P564", "P756", "P405", "P772", "P671", "P666", "P695", "P636", "P851", "P637", "P613", "P419", "P651", "P509", "P684", "P784", "017", "P944", "P439", "P455", "P485", "P473", "P397", "P530", "P489", "P689", "P429", "P686", "P673", "P468", "P653", "P831", "P583", "P719", "P355", "P533", "P824", "P738", "P612", "P716", "P467", "P494", "P641", "P648", "P484", "P736", "P617", "P495", "P517", "P591", "P814", "P619", "P883", "P818", "P761", "P709", "P692", "P876", "P916", "P512", "P764", "P956", "P633", "P571", "P827", "P424", "P407", "P622", "P782", "P592", "P413", "P437", "P713", "P492", "P525", "P751", "P514", "P453", "P616", "P609", "P939", "P946", "P460", "P838", "P804", "P734", "P469", "P542", "P481", "P660", "P442", "P438", "P590", "P536", "P426", "P550", "P589", "P887", "P390", "P791", "P513", "P758", "P646", "P561", "P526", "P535", "P578", "P519", "P420", "P663", "P892", "P521", "P921", "P679", "P767", "P835", "P444", "P478", "P870", "P789", "P672", "P629", "P654", "P548", "P627", "P443", "P649", "P803", "P399", "P643", "P430", "P816", "P518", "P847", "P669", "P715", "P480", "P566", "P486", "P710", "P687", "P819", "P745", "P739", "P950", "P504", "P925", "P700", "P845", "P625", "P817", "P659", "P507", "P457", "P930", "P505", "P423", "P635", "P553", "P464", "P793", "P499", "P631", "P539", "P873", "P503", "P786", "P683", "P842", "P928", "P475", "P891", "P584", "P569", "161", "P889", "P552", "P411", "P603", "P787", "P893", "P472", "P563", "P860", "P393", "P857", "P632", "P699", "P425", "P949", "P551", "P568", "P456", "P527", "P877", "P404", "P406", "P497", "P559", "P448", "P479", "P645", "P626", "P466", "P935", "P872", "P662", "P447", "P624", "P650", "P511", "P595", "P800", "P474", "P432", "P415", "P461", "P434", "P904", "P524", "P483", "P724", "P618", "P588", "P597", "P600", "P454", "P866", "P586", "P677", "P596", "P394", "P529", "P670", "P606", "018", "P502", "P703", "P605", "P435", "P579", "P957", "P543", "P577", "P441", "P567", "P770", "P449", "P720", "P773", "P496", "P587", "P523", "P427", "P570", "P471", "P628", "P865", "158", "265", "22R", "P041", "267", "22Q", "214", "P321", "P900", "202", "P828", "P934", "P895", "P324", "P337", "P372", "P326", "P363", "20U", "283", "P373", "P593", "P389", "P811", "P374", "P431", "22H", "P797", "P351", "P458", "P812", "P665", "P378", "298", "21L", "P537", "P320", "P907", "21Z", "P725", "22P", "P414", "P840", "P377", "P400", "296", "22M", "P410", "P834", "P862", "P861", "P450", "P368", "289", "075", "P565", "P890", "P376", "P345", "20B", "20Y", "P371", "P387", "P640", "P383", "P829", "21N", "P853", "281", "P743", "P515", "20I", "P701", "P354", "P867", "20F", "P806", "P365", "P330", "P380", "P790", "P336", "P813", "P440", "20N", "P369", "P508", "P436", "P395", "21E", "P765", "P388", "P370", "P933", "21M", "P604", "20D", "138", "P839", "20W", "057", "P452", "20L", "P581", "21D", "077", "P353", "P470", "P652", "21Q", "22E", "P737", "241", "P359", "P555", "P391", "P385", "P335", "P322", "P338", "279", "P493", "P610", "151", "154", "157", "091", "20K", "210", "141", "160", "P362", "P912", "139", "130", "063", "213", "22L", "101", "P344", "220", "297", "232", "025", "119", "218", "20P", "102", "P339", "062", "142", "P341", "127", "244", "204", "219"
    ]
}


async def verify_table_counts():
    """Verify record counts in both tables"""
    print("\n" + "="*80)
    print("STEP 1: VERIFYING TABLE RECORD COUNTS")
    print("="*80)
    
    try:
        await create_engines()
        from app.config.database import main_session_factory
        
        async with main_session_factory() as db:
            # Count zomato_pos_vs_3po_data
            count_query_zomato = text("SELECT COUNT(*) as count FROM zomato_pos_vs_3po_data")
            result_zomato = await db.execute(count_query_zomato)
            zomato_count = result_zomato.scalar()
            
            # Count orders_not_in_pos_data
            count_query_orders = text("SELECT COUNT(*) as count FROM orders_not_in_pos_data")
            result_orders = await db.execute(count_query_orders)
            orders_count = result_orders.scalar()
            
            print(f"\n✅ zomato_pos_vs_3po_data table: {zomato_count} records")
            print(f"✅ orders_not_in_pos_data table: {orders_count} records")
            
            if zomato_count == 96 and orders_count == 96:
                print("\n✅ VERIFICATION PASSED: Both tables have exactly 96 records as expected!")
            else:
                print(f"\n⚠️  VERIFICATION WARNING:")
                print(f"   Expected: 96 records in each table")
                print(f"   Actual - zomato_pos_vs_3po_data: {zomato_count} records")
                print(f"   Actual - orders_not_in_pos_data: {orders_count} records")
            
            # Get sample records
            print(f"\n📋 Sample records from zomato_pos_vs_3po_data (first 5):")
            sample_query_zomato = text("SELECT id, pos_order_id, zomato_order_id, order_date, store_name FROM zomato_pos_vs_3po_data LIMIT 5")
            samples_zomato = await db.execute(sample_query_zomato)
            for row in samples_zomato:
                print(f"   ID: {row.id}, POS Order: {row.pos_order_id}, Zomato Order: {row.zomato_order_id}, Date: {row.order_date}, Store: {row.store_name}")
            
            print(f"\n📋 Sample records from orders_not_in_pos_data (first 5):")
            sample_query_orders = text("SELECT id, zomato_order_id, order_date, store_name FROM orders_not_in_pos_data LIMIT 5")
            samples_orders = await db.execute(sample_query_orders)
            for row in samples_orders:
                print(f"   ID: {row.id}, Zomato Order: {row.zomato_order_id}, Date: {row.order_date}, Store: {row.store_name}")
            
    except Exception as e:
        print(f"\n❌ Error verifying table counts: {e}")
        import traceback
        traceback.print_exc()
        raise


async def test_api(endpoint, method="GET", payload=None, params=None):
    """Test an API endpoint"""
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {BEARER_TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            else:
                response = await client.post(url, headers=headers, json=payload)
            
            # Handle binary responses (like Excel files)
            content_type = response.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    response_data = response.json()
                except:
                    response_data = response.text
            elif "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in content_type or "application/octet-stream" in content_type:
                # Excel file - just note the size
                response_data = f"Binary file ({len(response.content)} bytes)"
            else:
                response_data = response.text[:500] if response.text else "Binary content"
            
            return {
                "status_code": response.status_code,
                "success": response.status_code < 400,
                "response": response_data,
                "headers": dict(response.headers)
            }
    except Exception as e:
        return {
            "status_code": 0,
            "success": False,
            "error": str(e),
            "response": None
        }


async def test_all_apis():
    """Test all relevant APIs"""
    print("\n" + "="*80)
    print("STEP 2: TESTING ALL RELEVANT APIs")
    print("="*80)
    
    results = {}
    
    # Test 1: Get sheet data for zomato_pos_vs_3po
    print("\n📡 Test 1: GET /api/sheet-data/data (zomato_pos_vs_3po)")
    print("-" * 80)
    store_codes_str = ",".join(PAYLOAD["stores"][:10])  # Use first 10 stores for testing
    params_zomato = {
        "sheet_type": "zomato_pos_vs_3po",
        "start_date": "2024-12-01",
        "end_date": "2024-12-07",
        "store_codes": store_codes_str
    }
    result1 = await test_api("/api/sheet-data/data", method="GET", params=params_zomato)
    results["sheet_data_zomato"] = result1
    print(f"   Status: {result1['status_code']}")
    if result1['success']:
        if isinstance(result1['response'], dict):
            data = result1['response'].get('data', [])
            print(f"   ✅ Success! Retrieved {len(data)} records")
            if 'metadata' in result1['response']:
                print(f"   Total records: {result1['response']['metadata'].get('total_records', 0)}")
        else:
            print(f"   ✅ Success! Response: {str(result1['response'])[:200]}")
    else:
        print(f"   ❌ Failed: {result1.get('error', result1.get('response', 'Unknown error'))}")
    
    # Test 2: Get sheet data for orders_not_in_pos
    print("\n📡 Test 2: GET /api/sheet-data/data (orders_not_in_pos)")
    print("-" * 80)
    params_orders = {
        "sheet_type": "orders_not_in_pos",
        "start_date": "2024-12-01",
        "end_date": "2024-12-07",
        "store_codes": store_codes_str
    }
    result2 = await test_api("/api/sheet-data/data", method="GET", params=params_orders)
    results["sheet_data_orders"] = result2
    print(f"   Status: {result2['status_code']}")
    if result2['success']:
        if isinstance(result2['response'], dict):
            data = result2['response'].get('data', [])
            print(f"   ✅ Success! Retrieved {len(data)} records")
            if 'metadata' in result2['response']:
                print(f"   Total records: {result2['response']['metadata'].get('total_records', 0)}")
        else:
            print(f"   ✅ Success! Response: {str(result2['response'])[:200]}")
    else:
        print(f"   ❌ Failed: {result2.get('error', result2.get('response', 'Unknown error'))}")
    
    # Test 3: Get threePODashboardData
    print("\n📡 Test 3: POST /api/reconciliation/threePODashboardData")
    print("-" * 80)
    result3 = await test_api("/api/reconciliation/threePODashboardData", method="POST", payload=PAYLOAD)
    results["three_po_dashboard"] = result3
    print(f"   Status: {result3['status_code']}")
    if result3['success']:
        if isinstance(result3['response'], dict):
            if result3['response'].get('success'):
                data = result3['response'].get('data', {})
                print(f"   ✅ Success!")
                print(f"   POS Sales: {data.get('posSales', 'N/A')}")
                print(f"   3PO Sales: {data.get('threePOSales', 'N/A')}")
                print(f"   Reconciled: {data.get('reconciled', 'N/A')}")
            else:
                print(f"   ⚠️  API returned success=false: {result3['response']}")
        else:
            print(f"   ✅ Success! Response: {str(result3['response'])[:200]}")
    else:
        print(f"   ❌ Failed: {result3.get('error', result3.get('response', 'Unknown error'))}")
    
    # Test 4: Get summary-sheet (async - this might take time)
    print("\n📡 Test 4: POST /api/reconciliation/summary-sheet")
    print("-" * 80)
    print("   ⚠️  Note: This endpoint may take longer to process...")
    result4 = await test_api("/api/reconciliation/summary-sheet", method="POST", payload=PAYLOAD)
    results["summary_sheet"] = result4
    print(f"   Status: {result4['status_code']}")
    if result4['success']:
        if result4['status_code'] == 200:
            print(f"   ✅ Success! Excel file generated (check Content-Type: {result4.get('headers', {}).get('content-type', 'N/A')})")
        else:
            print(f"   ✅ Success! Response: {str(result4['response'])[:200]}")
    else:
        print(f"   ❌ Failed: {result4.get('error', result4.get('response', 'Unknown error'))}")
    
    # Test 5: Get summary-sheet-sync
    print("\n📡 Test 5: POST /api/reconciliation/summary-sheet-sync")
    print("-" * 80)
    print("   ⚠️  Note: This endpoint may take longer to process...")
    result5 = await test_api("/api/reconciliation/summary-sheet-sync", method="POST", payload=PAYLOAD)
    results["summary_sheet_sync"] = result5
    print(f"   Status: {result5['status_code']}")
    if result5['success']:
        if result5['status_code'] == 200:
            print(f"   ✅ Success! Excel file generated (check Content-Type: {result5.get('headers', {}).get('content-type', 'N/A')})")
        else:
            print(f"   ✅ Success! Response: {str(result5['response'])[:200]}")
    else:
        print(f"   ❌ Failed: {result5.get('error', result5.get('response', 'Unknown error'))}")
    
    return results


async def generate_report(results):
    """Generate a comprehensive test report"""
    print("\n" + "="*80)
    print("STEP 3: TEST SUMMARY REPORT")
    print("="*80)
    
    print("\n📊 API Test Results:")
    print("-" * 80)
    
    test_names = {
        "sheet_data_zomato": "GET /api/sheet-data/data (zomato_pos_vs_3po)",
        "sheet_data_orders": "GET /api/sheet-data/data (orders_not_in_pos)",
        "three_po_dashboard": "POST /api/reconciliation/threePODashboardData",
        "summary_sheet": "POST /api/reconciliation/summary-sheet",
        "summary_sheet_sync": "POST /api/reconciliation/summary-sheet-sync"
    }
    
    passed = 0
    failed = 0
    
    for key, name in test_names.items():
        if key in results:
            result = results[key]
            status = "✅ PASSED" if result['success'] else "❌ FAILED"
            print(f"\n{status}: {name}")
            print(f"   Status Code: {result['status_code']}")
            if result['success']:
                passed += 1
            else:
                failed += 1
                if 'error' in result:
                    print(f"   Error: {result['error']}")
                elif 'response' in result:
                    print(f"   Response: {str(result['response'])[:200]}")
    
    print("\n" + "-" * 80)
    print(f"Total Tests: {passed + failed}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print("="*80)


async def main():
    """Main execution function"""
    print("\n" + "="*80)
    print("SHEET DATA VERIFICATION AND API TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Date Range: {PAYLOAD['startDate']} to {PAYLOAD['endDate']}")
    print(f"Number of Stores: {len(PAYLOAD['stores'])}")
    
    try:
        # Step 1: Verify table counts
        await verify_table_counts()
        
        # Step 2: Test all APIs
        results = await test_all_apis()
        
        # Step 3: Generate report
        await generate_report(results)
        
        print("\n✅ All verification and testing completed!")
        
    except Exception as e:
        print(f"\n❌ Error during execution: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

