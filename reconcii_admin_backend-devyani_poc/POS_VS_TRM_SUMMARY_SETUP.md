# POS vs TRM Summary Table Setup

## SQL Query to Create Table

```sql
CREATE TABLE IF NOT EXISTS `pos_vs_trm_summary` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pos_transaction_id` VARCHAR(255) DEFAULT NULL,
  `trm_transaction_id` VARCHAR(255) DEFAULT NULL,
  `pos_date` DATETIME DEFAULT NULL,
  `trm_date` DATETIME DEFAULT NULL,
  `pos_store` VARCHAR(255) DEFAULT NULL,
  `trm_store` VARCHAR(255) DEFAULT NULL,
  `pos_mode_name` VARCHAR(255) DEFAULT NULL,
  `acquirer` VARCHAR(100) DEFAULT NULL,
  `payment_mode` VARCHAR(100) DEFAULT NULL,
  `card_issuer` VARCHAR(100) DEFAULT NULL,
  `card_type` VARCHAR(100) DEFAULT NULL,
  `card_network` VARCHAR(100) DEFAULT NULL,
  `card_colour` VARCHAR(50) DEFAULT NULL,
  `pos_amount` FLOAT DEFAULT NULL,
  `trm_amount` FLOAT DEFAULT NULL,
  `reconciled_amount` FLOAT DEFAULT NULL,
  `unreconciled_amount` FLOAT DEFAULT NULL,
  `reconciliation_status` VARCHAR(50) DEFAULT NULL,
  `pos_reason` TEXT DEFAULT NULL,
  `trm_reason` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `ix_pos_vs_trm_summary_pos_transaction_id` (`pos_transaction_id`),
  INDEX `ix_pos_vs_trm_summary_trm_transaction_id` (`trm_transaction_id`),
  INDEX `ix_pos_vs_trm_summary_reconciliation_status` (`reconciliation_status`),
  INDEX `ix_pos_vs_trm_summary_pos_store` (`pos_store`),
  INDEX `ix_pos_vs_trm_summary_pos_date` (`pos_date`),
  INDEX `ix_pos_vs_trm_summary_payment_mode` (`payment_mode`),
  INDEX `ix_pos_vs_trm_summary_acquirer` (`acquirer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Note:** This query is also available in `CREATE_pos_vs_trm_summary.sql`

---

## Solution Implementation

### What Was Changed

The `/api/node/reconciliation/generate-common-trm` endpoint now orchestrates the complete reconciliation pipeline automatically.

### Updated Flow

The `calculatePosVsTrm` function now:

1. **Checks if table exists** - If `pos_vs_trm_summary` doesn't exist, it creates it automatically using Sequelize `sync()`
2. **Step 1: Generate Common TRM Table** - Populates `summarised_trm_data` from TRM provider tables (`trm_mpr`)
3. **Step 2: Process Orders Data** - Populates `pos_vs_trm_summary` with POS data from `orders` table
4. **Step 3: Process TRM Data** - Merges TRM data from `summarised_trm_data` into `pos_vs_trm_summary`
5. **Step 4: Calculate Reconciliation** - Calculates reconciliation status for all records

### Code Changes

1. **Created internal functions** that don't require `req/res`:
   - `generateCommonTRMTableInternal()`
   - `processOrdersDataInternal()`
   - `processTrmDataInternal()`

2. **Updated `calculatePosVsTrm`** to:
   - Check and create table if needed
   - Call all pipeline steps in sequence
   - Provide detailed logging
   - Return comprehensive results

3. **Maintained backward compatibility** - All original API endpoints still work:
   - `generateCommonTRMTable` - Can be called independently
   - `processOrdersData` - Can be called independently
   - `processTrmData` - Can be called independently
   - `calculatePosVsTrm` - Now orchestrates the full pipeline

### Response Format

The endpoint now returns:

```json
{
  "success": true,
  "message": "Reconciliation calculation completed successfully",
  "data": {
    "totalProcessed": 1234,
    "totalReconciled": 800,
    "totalUnreconciled": 434,
    "pipeline": {
      "trmRecordsProcessed": 500,
      "ordersProcessed": 1200,
      "trmDataMerged": 1234
    }
  }
}
```

### Logging

The function now provides detailed console logs for each step:
- Table creation status
- Step-by-step progress
- Record counts at each stage
- Final reconciliation summary

---

## Testing

To test the endpoint:

```bash
POST /api/node/reconciliation/generate-common-trm
```

The endpoint will automatically:
- Create the table if it doesn't exist
- Run the complete data pipeline
- Calculate reconciliation status
- Return results

No manual table creation required!

