#!/usr/bin/env python3
"""
Test script to compare Node.js and Python backend responses for instore-data API
"""
import requests
import json
from datetime import datetime

# Configuration
NODE_API_URL = "http://localhost:3000/api/node/reconciliation/instore-data"
PYTHON_API_URL = "http://localhost:8000/api/reconciliation/instore-data"
BEARER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDQ1LCJlbWFpbCI6ImphdGluQGNvcmVwZWVsZXJzLmNvbSIsInJvbGUiOjIsIm9yZ2FuaXphdGlvbiI6MTAwMTMsIm5hbWUiOiJVc2VyIiwidXNlcm5hbWUiOiJkZXZ5YW5pX3VzZXIiLCJleHAiOjE3NjI0OTU3NzEsImp0aSI6ImRldnlhbmlfdXNlciJ9.bGmNemtRKtwjc-VzWmIIp_mAz6eguuAOTdg76q21_xk"

# Test payload
payload = {
    "startDate": "2024-12-01 00:00:00",
    "endDate": "2024-12-07 23:59:59",
    "stores": ["141"]
}

headers = {
    "Authorization": f"Bearer {BEARER_TOKEN}",
    "Content-Type": "application/json"
}

def compare_responses(node_resp, python_resp):
    """Compare two responses and identify differences"""
    print("\n" + "="*80)
    print("COMPARISON ANALYSIS")
    print("="*80)
    
    node_data = node_resp.get("data", {})
    python_data = python_resp.get("data", {})
    
    # Top-level comparison
    print("\n📊 TOP-LEVEL METRICS:")
    print("-" * 80)
    metrics = ["sales", "salesCount", "receipts", "receiptsCount", "reconciled", 
               "reconciledCount", "difference", "differenceCount", "posVsTrm", 
               "trmVsMpr", "aggregatorTotal"]
    
    for metric in metrics:
        node_val = node_data.get(metric, 0)
        python_val = python_data.get(metric, 0)
        status = "✅" if node_val == python_val else "❌"
        print(f"{status} {metric:20s} | Node: {str(node_val):15s} | Python: {str(python_val):15s}")
    
    # Tender-wise comparison
    print("\n📋 TENDER-WISE DATA:")
    print("-" * 80)
    node_tenders = {t["tenderName"]: t for t in node_data.get("tenderWiseDataList", [])}
    python_tenders = {t["tenderName"]: t for t in python_data.get("tenderWiseDataList", [])}
    
    for tender_name in ["CARD", "UPI"]:
        print(f"\n🔹 {tender_name}:")
        node_tender = node_tenders.get(tender_name, {})
        python_tender = python_tenders.get(tender_name, {})
        
        for metric in ["sales", "salesCount", "posVsTrm", "trmVsMpr"]:
            node_val = node_tender.get(metric, 0)
            python_val = python_tender.get(metric, 0)
            status = "✅" if node_val == python_val else "❌"
            print(f"  {status} {metric:15s} | Node: {str(node_val):15s} | Python: {str(python_val):15s}")
        
        # Bank-wise comparison
        node_banks = {b["bankName"]: b for b in node_tender.get("bankWiseDataList", [])}
        python_banks = {b["bankName"]: b for b in python_tender.get("bankWiseDataList", [])}
        
        print(f"  📌 Bank-wise data:")
        all_banks = set(list(node_banks.keys()) + list(python_banks.keys()))
        for bank_name in sorted(all_banks):
            node_bank = node_banks.get(bank_name, {})
            python_bank = python_banks.get(bank_name, {})
            node_sales = node_bank.get("sales", 0)
            python_sales = python_bank.get("sales", 0)
            status = "✅" if node_sales == python_sales else "❌"
            print(f"    {status} {bank_name:20s} | Node: {str(node_sales):15s} | Python: {str(python_sales):15s}")

def main():
    print("="*80)
    print("INSTORE-DATA API COMPARISON TEST")
    print("="*80)
    print(f"\nTest Payload: {json.dumps(payload, indent=2)}")
    
    # Test Node.js API
    print("\n" + "="*80)
    print("1. Testing Node.js Backend")
    print("="*80)
    try:
        node_response = requests.post(NODE_API_URL, json=payload, headers=headers, timeout=30)
        print(f"Status Code: {node_response.status_code}")
        if node_response.status_code == 200:
            node_data = node_response.json()
            print(f"✅ Node.js API Success")
            print(f"   Sales: {node_data.get('data', {}).get('sales', 0)}")
            print(f"   Sales Count: {node_data.get('data', {}).get('salesCount', 0)}")
        else:
            print(f"❌ Node.js API Error: {node_response.text}")
            node_data = None
    except Exception as e:
        print(f"❌ Node.js API Exception: {str(e)}")
        node_data = None
    
    # Test Python API
    print("\n" + "="*80)
    print("2. Testing Python Backend")
    print("="*80)
    try:
        python_response = requests.post(PYTHON_API_URL, json=payload, headers=headers, timeout=30)
        print(f"Status Code: {python_response.status_code}")
        if python_response.status_code == 200:
            python_data = python_response.json()
            print(f"✅ Python API Success")
            print(f"   Sales: {python_data.get('data', {}).get('sales', 0)}")
            print(f"   Sales Count: {python_data.get('data', {}).get('salesCount', 0)}")
        else:
            print(f"❌ Python API Error: {python_response.text}")
            python_data = None
    except Exception as e:
        print(f"❌ Python API Exception: {str(e)}")
        python_data = None
    
    # Compare if both succeeded
    if node_data and python_data:
        compare_responses(node_data, python_data)
        
        # Save full responses
        with open("node_response.json", "w") as f:
            json.dump(node_data, f, indent=2)
        with open("python_response.json", "w") as f:
            json.dump(python_data, f, indent=2)
        print("\n💾 Full responses saved to node_response.json and python_response.json")
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()

