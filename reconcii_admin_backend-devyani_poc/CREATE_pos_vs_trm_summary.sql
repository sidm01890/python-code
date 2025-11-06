-- ============================================
-- CREATE pos_vs_trm_summary TABLE
-- ============================================
-- This table is required for bank-wise reconciliation data
-- It stores POS vs TRM reconciliation results
-- This table needs to be populated by a reconciliation process/job

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

