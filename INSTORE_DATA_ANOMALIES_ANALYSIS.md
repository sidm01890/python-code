# Instore-Data API Anomalies Analysis

## Executive Summary

This document details the critical differences between the Node.js and Python backend implementations of the `/instore-data` API endpoint that result in the Python backend returning zero values while the Node.js backend returns actual sales data.

---

## Critical Anomaly #1: Wrong Data Source for POS Sales

### **Node.js Implementation** ✅
```javascript
// Line 3310-3332 in reco.controller.js
const posSalesData = await db.orders.findAll({
  where: {
    date: { [Op.between]: [startDate, endDate] },
    store_name: { [Op.in]: stores },
    [Op.or]: [
      literal("UPPER(online_order_taker) = 'CARD'"),
      literal("UPPER(online_order_taker) = 'UPI'"),
      // ...
    ],
  },
  attributes: [
    "online_order_taker",
    [fn("SUM", col("payment")), "sales"],
    [fn("COUNT", col("payment")), "salesCount"],
  ],
  group: ["online_order_taker"],
});
```

**Source Table**: `orders`  
**Filter Column**: `online_order_taker`  
**Aggregation Column**: `payment`

### **Python Implementation** ❌
```python
# Line 2466-2486 in reconciliation.py
pos_sales_query_str = f"""
    SELECT 
        UPPER(TRIM(payment_mode)) AS payment_mode,
        SUM(CAST(COALESCE(amount, 0) AS DECIMAL(15,2))) AS sales,
        COUNT(CASE WHEN amount IS NOT NULL AND amount != 0 THEN 1 END) AS salesCount
    FROM trm
    WHERE STR_TO_DATE(date, '%Y-%m-%d %H:%i:%s') BETWEEN ...
    AND store_name IN ({stores_placeholder_2})
    AND (
        UPPER(TRIM(payment_mode)) = 'CARD'
        OR UPPER(TRIM(payment_mode)) = 'UPI'
    )
    GROUP BY UPPER(TRIM(payment_mode))
"""
```

**Source Table**: `trm` ❌ (WRONG!)  
**Filter Column**: `payment_mode`  
**Aggregation Column**: `amount`

### **Impact**
- Python backend is querying the wrong table (`trm` instead of `orders`)
- The `trm` table may not have data for the date range, or may have different semantics
- Node.js correctly uses `orders.online_order_taker` to identify CARD/UPI sales
- Python should use `orders.online_order_taker` instead of `trm.payment_mode`

---

## Critical Anomaly #2: Missing Orders Table Query

The Python backend **completely misses** the primary data source query that Node.js uses:

### **Node.js Flow:**
1. ✅ Query `orders` table for POS sales (CARD/UPI via `online_order_taker`)
2. ✅ Query `pos_vs_trm_summary` for reconciliation data (optional)
3. ✅ Query `trm` table for TRM data (for `trmVsMpr` calculation)

### **Python Flow:**
1. ❌ Query `trm` table for POS sales (WRONG - should be `orders`)
2. ✅ Query `pos_vs_trm_summary` for reconciliation data (optional)
3. ✅ Query `trm` table for TRM data (for `trmVsMpr` calculation)

### **Missing Logic**
The Python backend never queries the `orders` table for initial sales data, which is the primary source in Node.js.

---

## Anomaly #3: Data Processing Logic Mismatch

### **Node.js Processing:**
```javascript
// Line 3502-3520
posSalesData.forEach((row) => {
  const tender = row.online_order_taker;  // From orders table
  const sales = parseFloat(row.sales || 0);
  
  if (tender === "CARD" && tenderWiseData.CARD) {
    tenderWiseData.CARD.sales += sales;
    tenderWiseData.CARD.salesCount += salesCount;
    tenderWiseData.CARD.posVsTrm = sales;  // Sets posVsTrm from orders
  }
  // ...
});
```

### **Python Processing:**
```python
# Line 2620-2637
for row in pos_sales_rows:  # From trm table (WRONG!)
    tender = (row.payment_mode or "").strip().upper()
    sales = float(row.sales or 0)
    
    if tender == "CARD" and "CARD" in tenderWiseData:
        tenderWiseData["CARD"]["sales"] += sales
        tenderWiseData["CARD"]["posVsTrm"] = sales  # Sets posVsTrm from trm
```

### **Issue**
- Python uses `trm.payment_mode` instead of `orders.online_order_taker`
- The `posVsTrm` value should come from `orders` table, not `trm` table
- Node.js uses `orders` as the source of truth for initial sales

---

## Anomaly #4: Reconciliation Data Dependency

Both implementations have fallback logic, but Python's fallback is broken:

### **Node.js Fallback:**
```javascript
// Line 3592-3596
// If reconciliation table had no data, use orders table data instead
if (tenderData.sales === 0 && salesFromOrders > 0) {
  tenderData.sales = salesFromOrders;
  tenderData.salesCount = salesCountFromOrders;
}
```

### **Python Fallback:**
```python
# Line 2855-2858
# If reconciliation table had no data, use orders table data instead
if tender_data["sales"] == 0 and sales_from_orders > 0:
    tender_data["sales"] = sales_from_orders
    tender_data["salesCount"] = sales_count_from_orders
```

### **Problem**
- Python's `sales_from_orders` comes from `trm` table (line 2621-2637), not `orders` table
- This means the fallback is also broken because it's using the wrong source

---

## Anomaly #5: Column Name Mismatch

### **Node.js:**
- Uses `orders.online_order_taker` to identify CARD/UPI
- Uses `orders.payment` for sales amount

### **Python:**
- Uses `trm.payment_mode` to identify CARD/UPI
- Uses `trm.amount` for sales amount

These are **different tables with different semantics**:
- `orders` table: Contains POS order data with `online_order_taker` field
- `trm` table: Contains TRM (Terminal) transaction data with `payment_mode` field

---

## Root Cause Analysis

### **Primary Root Cause:**
The Python backend was incorrectly implemented to query the `trm` table for POS sales data instead of the `orders` table. This is a fundamental misunderstanding of the data model.

### **Why This Happened:**
1. The code comment says "POS Sales Data for CARD/UPI from trm table" - this is incorrect
2. The Node.js implementation clearly uses `orders` table, but Python implementation diverged
3. The `trm` table is used for TRM data (terminal reconciliation), not for POS sales

### **Data Flow in Node.js (Correct):**
```
orders table (online_order_taker = 'CARD'/'UPI')
    ↓
Initial sales data
    ↓
pos_vs_trm_summary (if populated)
    ↓
Bank-wise reconciliation data
    ↓
Final response
```

### **Data Flow in Python (Broken):**
```
trm table (payment_mode = 'CARD'/'UPI')  ❌ WRONG SOURCE
    ↓
No data or wrong data
    ↓
pos_vs_trm_summary (if populated)
    ↓
Bank-wise reconciliation data (if exists)
    ↓
Final response (mostly zeros)
```

---

## Fix Required

### **Step 1: Add Orders Table Query**
Replace Query 2 in Python backend to query `orders` table:

```python
# Query 2: POS Sales Data for CARD/UPI from orders table (NOT trm!)
pos_sales_query_str = f"""
    SELECT 
        UPPER(TRIM(online_order_taker)) AS tender,
        SUM(CAST(COALESCE(payment, 0) AS DECIMAL(15,2))) AS sales,
        COUNT(CASE WHEN payment IS NOT NULL AND payment != 0 THEN 1 END) AS salesCount
    FROM orders
    WHERE date BETWEEN :start_date AND :end_date
    AND store_name IN ({stores_placeholder_2})
    AND (
        UPPER(TRIM(online_order_taker)) = 'CARD'
        OR UPPER(TRIM(online_order_taker)) = 'UPI'
    )
    GROUP BY UPPER(TRIM(online_order_taker))
"""
```

### **Step 2: Update Processing Logic**
```python
# Process POS sales data from orders table (not trm)
for row in pos_sales_rows:
    tender = (row.tender or "").strip().upper()  # Changed from payment_mode
    sales = float(row.sales or 0)
    sales_count = int(row.salesCount or 0)
    
    if tender == "CARD" and "CARD" in tenderWiseData:
        tenderWiseData["CARD"]["sales"] += sales
        tenderWiseData["CARD"]["salesCount"] += sales_count
        tenderWiseData["CARD"]["posVsTrm"] = sales
    elif tender == "UPI" and "UPI" in tenderWiseData:
        tenderWiseData["UPI"]["sales"] += sales
        tenderWiseData["UPI"]["salesCount"] += sales_count
        tenderWiseData["UPI"]["posVsTrm"] = sales
```

### **Step 3: Keep TRM Query Separate**
The `trm` table query should remain as Query 4 (for `trmVsMpr` calculation), but should NOT be used for initial sales data.

---

## Additional Observations

### **1. Date Format Handling**
Both implementations try multiple date formats for `trm` table, which is good. However, the `orders` table date format should be consistent.

### **2. Store Name Matching**
Both use `store_name IN (...)` for filtering. Need to verify store IDs match between databases.

### **3. Reconciliation Table**
The `pos_vs_trm_summary` table is optional and may not be populated. The fallback to `orders` table is critical.

### **4. Aggregator Total**
Both implementations correctly query `orders` table for aggregator total (Zomato, Swiggy, MagicPin).

---

## Test Scenario Results

### **Test Payload:**
```json
{
  "startDate": "2024-12-01 00:00:00",
  "endDate": "2024-12-07 23:59:59",
  "stores": ["141"]
}
```

### **Node.js Response:**
- ✅ `sales`: 106121.39
- ✅ `salesCount`: 365
- ✅ `tenderWiseDataList`: Contains CARD and UPI with actual data
- ✅ `aggregatorTotal`: 57503.91

### **Python Response:**
- ❌ `sales`: 0
- ❌ `salesCount`: 0
- ❌ `tenderWiseDataList`: Contains CARD and UPI with all zeros
- ❌ `aggregatorTotal`: 0.0

### **Why Python Returns Zeros:**
1. Query 2 queries `trm` table instead of `orders` table
2. `trm` table may not have data for this date range/store
3. Reconciliation table (`pos_vs_trm_summary`) may be empty
4. Fallback logic uses wrong data source (`trm` instead of `orders`)

---

## Summary of Anomalies

| # | Anomaly | Severity | Impact |
|---|---------|-----------|--------|
| 1 | Wrong data source (trm vs orders) | 🔴 Critical | Python returns zero sales |
| 2 | Missing orders table query | 🔴 Critical | No initial sales data |
| 3 | Wrong column name (payment_mode vs online_order_taker) | 🔴 Critical | Data filtering fails |
| 4 | Broken fallback logic | 🟡 High | Fallback uses wrong source |
| 5 | Column name mismatch | 🟡 High | Data mapping incorrect |

---

## Recommended Actions

1. **Immediate Fix**: Update Python Query 2 to use `orders` table instead of `trm` table
2. **Test**: Run test script to verify both APIs return matching data
3. **Validation**: Ensure `orders` table has data for the test date range
4. **Documentation**: Update code comments to reflect correct data sources
5. **Review**: Audit other endpoints for similar data source mismatches

---

## Conclusion

The Python backend implementation has a fundamental flaw: it queries the wrong table (`trm` instead of `orders`) for POS sales data. This causes all sales metrics to return zero. The fix is straightforward but critical - replace the `trm` table query with an `orders` table query matching the Node.js implementation.

