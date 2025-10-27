const db = require("../models");
const { Op, fn, col, literal, Sequelize } = require("sequelize");
const path = require("path");
const fs = require("fs");

// Function to populate sheet data tables
const populateSheetDataTables = async (start_date, end_date, store_codes) => {
  try {
    // Truncate all tables before populating
    console.log("Truncating existing data from tables...");
    await db.zomato_pos_vs_3po_data.destroy({ truncate: true });
    await db.zomato_3po_vs_pos_data.destroy({ truncate: true });
    await db.zomato_3po_vs_pos_refund_data.destroy({ truncate: true });
    await db.orders_not_in_pos_data.destroy({ truncate: true });
    await db.orders_not_in_3po_data.destroy({ truncate: true });
    console.log("Tables truncated successfully");

    console.log("Starting to populate sheet data tables...");

    // 1. Populate Zomato POS vs 3PO data
    console.log("Populating Zomato POS vs 3PO data...");
    const posVsZomatoData = await db.zomato_vs_pos_summary.findAll({
      where: {
        [Op.and]: [{ pos_order_id: { [Op.ne]: null } }],
      },
      raw: true,
    });

    await db.zomato_pos_vs_3po_data.bulkCreate(
      posVsZomatoData.map((record) => ({
        id: `ZPV3_${record.pos_order_id}`,
        pos_order_id: record.pos_order_id,
        zomato_order_id: record.zomato_order_id,
        order_date: record.order_date,
        store_name: record.store_name,
        pos_net_amount: record.pos_net_amount,
        zomato_net_amount: record.zomato_net_amount,
        pos_vs_zomato_net_amount_delta: record.pos_vs_zomato_net_amount_delta,
        pos_tax_paid_by_customer: record.pos_tax_paid_by_customer,
        zomato_tax_paid_by_customer: record.zomato_tax_paid_by_customer,
        pos_vs_zomato_tax_paid_by_customer_delta:
          record.pos_vs_zomato_tax_paid_by_customer_delta,
        pos_commission_value: record.pos_commission_value,
        zomato_commission_value: record.zomato_commission_value,
        pos_vs_zomato_commission_value_delta:
          record.pos_vs_zomato_commission_value_delta,
        pos_pg_applied_on: record.pos_pg_applied_on,
        zomato_pg_applied_on: record.zomato_pg_applied_on,
        pos_vs_zomato_pg_applied_on_delta:
          record.pos_vs_zomato_pg_applied_on_delta,
        pos_pg_charge: record.pos_pg_charge,
        zomato_pg_charge: record.zomato_pg_charge,
        pos_vs_zomato_pg_charge_delta: record.pos_vs_zomato_pg_charge_delta,
        pos_taxes_zomato_fee: record.pos_taxes_zomato_fee,
        zomato_taxes_zomato_fee: record.zomato_taxes_zomato_fee,
        pos_vs_zomato_taxes_zomato_fee_delta:
          record.pos_vs_zomato_taxes_zomato_fee_delta,
        pos_tds_amount: record.pos_tds_amount,
        zomato_tds_amount: record.zomato_tds_amount,
        pos_vs_zomato_tds_amount_delta: record.pos_vs_zomato_tds_amount_delta,
        pos_final_amount: record.pos_final_amount,
        zomato_final_amount: record.zomato_final_amount,
        pos_vs_zomato_final_amount_delta:
          record.pos_vs_zomato_final_amount_delta,
        reconciled_status: record.reconciled_status,
        reconciled_amount: record.reconciled_amount,
        unreconciled_amount: record.unreconciled_amount,
        pos_vs_zomato_reason: record.pos_vs_zomato_reason,
        order_status_pos: record.order_status_pos,
        created_at: new Date(),
        updated_at: new Date(),
      })),
      { updateOnDuplicate: ["updated_at"] }
    );

    // 2. Populate Zomato 3PO vs POS data (sale and addition)
    console.log("Populating Zomato 3PO vs POS data...");
    const zomatoVsPosData = await db.zomato_vs_pos_summary.findAll({
      where: {
        zomato_order_id: { [Op.ne]: null },
      },
      raw: true,
    });

    await db.zomato_3po_vs_pos_data.bulkCreate(
      zomatoVsPosData.map((record) => ({
        id: `Z3PVP_${record.zomato_order_id}`,
        zomato_order_id: record.zomato_order_id,
        pos_order_id: record.pos_order_id,
        order_date: record.order_date,
        store_name: record.store_name,
        zomato_net_amount: record.zomato_net_amount,
        pos_net_amount: record.pos_net_amount,
        zomato_vs_pos_net_amount_delta: record.zomato_vs_pos_net_amount_delta,
        zomato_tax_paid_by_customer: record.zomato_tax_paid_by_customer,
        pos_tax_paid_by_customer: record.pos_tax_paid_by_customer,
        zomato_vs_pos_tax_paid_by_customer_delta:
          record.zomato_vs_pos_tax_paid_by_customer_delta,
        zomato_commission_value: record.zomato_commission_value,
        pos_commission_value: record.pos_commission_value,
        zomato_vs_pos_commission_value_delta:
          record.zomato_vs_pos_commission_value_delta,
        zomato_pg_applied_on: record.zomato_pg_applied_on,
        pos_pg_applied_on: record.pos_pg_applied_on,
        zomato_vs_pos_pg_applied_on_delta:
          record.zomato_vs_pos_pg_applied_on_delta,
        zomato_pg_charge: record.zomato_pg_charge,
        pos_pg_charge: record.pos_pg_charge,
        zomato_vs_pos_pg_charge_delta: record.zomato_vs_pos_pg_charge_delta,
        zomato_taxes_zomato_fee: record.zomato_taxes_zomato_fee,
        pos_taxes_zomato_fee: record.pos_taxes_zomato_fee,
        zomato_vs_pos_taxes_zomato_fee_delta:
          record.zomato_vs_pos_taxes_zomato_fee_delta,
        zomato_tds_amount: record.zomato_tds_amount,
        pos_tds_amount: record.pos_tds_amount,
        zomato_vs_pos_tds_amount_delta: record.zomato_vs_pos_tds_amount_delta,
        zomato_final_amount: record.zomato_final_amount,
        pos_final_amount: record.pos_final_amount,
        zomato_vs_pos_final_amount_delta:
          record.zomato_vs_pos_final_amount_delta,
        calculated_zomato_net_amount: record.calculated_zomato_net_amount,
        calculated_zomato_tax_paid_by_customer:
          record.calculated_zomato_tax_paid_by_customer,
        calculated_zomato_commission_value:
          record.calculated_zomato_commission_value,
        calculated_zomato_pg_applied_on: record.calculated_zomato_pg_applied_on,
        calculated_zomato_pg_charge: record.calculated_zomato_pg_charge,
        calculated_zomato_taxes_zomato_fee:
          record.calculated_zomato_taxes_zomato_fee,
        calculated_zomato_tds_amount: record.calculated_zomato_tds_amount,
        calculated_zomato_final_amount: record.calculated_zomato_final_amount,
        fixed_credit_note_amount: record.fixed_credit_note_amount,
        fixed_pro_discount_passthrough: record.fixed_pro_discount_passthrough,
        fixed_customer_discount: record.fixed_customer_discount,
        fixed_rejection_penalty_charge: record.fixed_rejection_penalty_charge,
        fixed_user_credits_charge: record.fixed_user_credits_charge,
        fixed_promo_recovery_adj: record.fixed_promo_recovery_adj,
        fixed_icecream_handling: record.fixed_icecream_handling,
        fixed_icecream_deductions: record.fixed_icecream_deductions,
        fixed_order_support_cost: record.fixed_order_support_cost,
        fixed_merchant_delivery_charge: record.fixed_merchant_delivery_charge,
        reconciled_status: record.reconciled_status,
        reconciled_amount: record.reconciled_amount,
        unreconciled_amount: record.unreconciled_amount,
        zomato_vs_pos_reason: record.zomato_vs_pos_reason,
        order_status_zomato: record.order_status_zomato,
        created_at: new Date(),
        updated_at: new Date(),
      })),
      { updateOnDuplicate: ["updated_at"] }
    );

    // 3. Populate Zomato 3PO vs POS Refund data
    console.log("Populating Zomato 3PO vs POS Refund data...");
    const zomatoVsPosRefundData = await db.zomato_vs_pos_summary.findAll({
      where: {
        [Op.and]: [
          { zomato_order_id: { [Op.ne]: null } },
          { order_status_zomato: "refund" },
        ],
      },
      raw: true,
    });

    await db.zomato_3po_vs_pos_refund_data.bulkCreate(
      zomatoVsPosRefundData.map((record) => ({
        id: `Z3PVPR_${record.zomato_order_id}`,
        zomato_order_id: record.zomato_order_id,
        pos_order_id: record.pos_order_id,
        order_date: record.order_date,
        store_name: record.store_name,
        zomato_net_amount: record.zomato_net_amount,
        pos_net_amount: record.pos_net_amount,
        zomato_vs_pos_net_amount_delta: record.zomato_vs_pos_net_amount_delta,
        zomato_tax_paid_by_customer: record.zomato_tax_paid_by_customer,
        pos_tax_paid_by_customer: record.pos_tax_paid_by_customer,
        zomato_vs_pos_tax_paid_by_customer_delta:
          record.zomato_vs_pos_tax_paid_by_customer_delta,
        zomato_commission_value: record.zomato_commission_value,
        pos_commission_value: record.pos_commission_value,
        zomato_vs_pos_commission_value_delta:
          record.zomato_vs_pos_commission_value_delta,
        zomato_pg_applied_on: record.zomato_pg_applied_on,
        pos_pg_applied_on: record.pos_pg_applied_on,
        zomato_vs_pos_pg_applied_on_delta:
          record.zomato_vs_pos_pg_applied_on_delta,
        zomato_pg_charge: record.zomato_pg_charge,
        pos_pg_charge: record.pos_pg_charge,
        zomato_vs_pos_pg_charge_delta: record.zomato_vs_pos_pg_charge_delta,
        zomato_taxes_zomato_fee: record.zomato_taxes_zomato_fee,
        pos_taxes_zomato_fee: record.pos_taxes_zomato_fee,
        zomato_vs_pos_taxes_zomato_fee_delta:
          record.zomato_vs_pos_taxes_zomato_fee_delta,
        zomato_tds_amount: record.zomato_tds_amount,
        pos_tds_amount: record.pos_tds_amount,
        zomato_vs_pos_tds_amount_delta: record.zomato_vs_pos_tds_amount_delta,
        zomato_final_amount: record.zomato_final_amount,
        pos_final_amount: record.pos_final_amount,
        zomato_vs_pos_final_amount_delta:
          record.zomato_vs_pos_final_amount_delta,
        calculated_zomato_net_amount: record.calculated_zomato_net_amount,
        calculated_zomato_tax_paid_by_customer:
          record.calculated_zomato_tax_paid_by_customer,
        calculated_zomato_commission_value:
          record.calculated_zomato_commission_value,
        calculated_zomato_pg_applied_on: record.calculated_zomato_pg_applied_on,
        calculated_zomato_pg_charge: record.calculated_zomato_pg_charge,
        calculated_zomato_taxes_zomato_fee:
          record.calculated_zomato_taxes_zomato_fee,
        calculated_zomato_tds_amount: record.calculated_zomato_tds_amount,
        calculated_zomato_final_amount: record.calculated_zomato_final_amount,
        fixed_credit_note_amount: record.fixed_credit_note_amount,
        fixed_pro_discount_passthrough: record.fixed_pro_discount_passthrough,
        fixed_customer_discount: record.fixed_customer_discount,
        fixed_rejection_penalty_charge: record.fixed_rejection_penalty_charge,
        fixed_user_credits_charge: record.fixed_user_credits_charge,
        fixed_promo_recovery_adj: record.fixed_promo_recovery_adj,
        fixed_icecream_handling: record.fixed_icecream_handling,
        fixed_icecream_deductions: record.fixed_icecream_deductions,
        fixed_order_support_cost: record.fixed_order_support_cost,
        fixed_merchant_delivery_charge: record.fixed_merchant_delivery_charge,
        reconciled_status: record.reconciled_status,
        reconciled_amount: record.reconciled_amount,
        unreconciled_amount: record.unreconciled_amount,
        zomato_vs_pos_reason: record.zomato_vs_pos_reason,
        order_status_zomato: record.order_status_zomato,
        created_at: new Date(),
        updated_at: new Date(),
      })),
      { updateOnDuplicate: ["updated_at"] }
    );

    // 4. Populate Orders not found in POS
    console.log("Populating Orders not found in POS data...");
    const ordersNotInPos = await db.zomato_vs_pos_summary.findAll({
      where: {
        [Op.and]: [
          { pos_order_id: null },
          { zomato_order_id: { [Op.ne]: null } },
        ],
      },
      raw: true,
    });

    await db.orders_not_in_pos_data.bulkCreate(
      ordersNotInPos.map((record) => ({
        id: `ONIP_${record.zomato_order_id}`,
        zomato_order_id: record.zomato_order_id,
        order_date: record.order_date,
        store_name: record.store_name,
        zomato_net_amount: record.zomato_net_amount,
        zomato_tax_paid_by_customer: record.zomato_tax_paid_by_customer,
        zomato_commission_value: record.zomato_commission_value,
        zomato_pg_applied_on: record.zomato_pg_applied_on,
        zomato_pg_charge: record.zomato_pg_charge,
        zomato_taxes_zomato_fee: record.zomato_taxes_zomato_fee,
        zomato_tds_amount: record.zomato_tds_amount,
        zomato_final_amount: record.zomato_final_amount,
        calculated_zomato_net_amount: record.calculated_zomato_net_amount,
        calculated_zomato_tax_paid_by_customer:
          record.calculated_zomato_tax_paid_by_customer,
        calculated_zomato_commission_value:
          record.calculated_zomato_commission_value,
        calculated_zomato_pg_applied_on: record.calculated_zomato_pg_applied_on,
        calculated_zomato_pg_charge: record.calculated_zomato_pg_charge,
        calculated_zomato_taxes_zomato_fee:
          record.calculated_zomato_taxes_zomato_fee,
        calculated_zomato_tds_amount: record.calculated_zomato_tds_amount,
        calculated_zomato_final_amount: record.calculated_zomato_final_amount,
        fixed_credit_note_amount: record.fixed_credit_note_amount,
        fixed_pro_discount_passthrough: record.fixed_pro_discount_passthrough,
        fixed_customer_discount: record.fixed_customer_discount,
        fixed_rejection_penalty_charge: record.fixed_rejection_penalty_charge,
        fixed_user_credits_charge: record.fixed_user_credits_charge,
        fixed_promo_recovery_adj: record.fixed_promo_recovery_adj,
        fixed_icecream_handling: record.fixed_icecream_handling,
        fixed_icecream_deductions: record.fixed_icecream_deductions,
        fixed_order_support_cost: record.fixed_order_support_cost,
        fixed_merchant_delivery_charge: record.fixed_merchant_delivery_charge,
        reconciled_status: record.reconciled_status,
        reconciled_amount: record.reconciled_amount,
        unreconciled_amount: record.unreconciled_amount,
        zomato_vs_pos_reason: record.zomato_vs_pos_reason,
        order_status_zomato: record.order_status_zomato,
        created_at: new Date(),
        updated_at: new Date(),
      })),
      { updateOnDuplicate: ["updated_at"] }
    );

    // 5. Populate Orders not found in 3PO
    console.log("Populating Orders not found in 3PO data...");
    const ordersNotInZomato = await db.zomato_vs_pos_summary.findAll({
      where: {
        [Op.and]: [
          { zomato_order_id: null },
          { pos_order_id: { [Op.ne]: null } },
        ],
      },
      raw: true,
    });

    await db.orders_not_in_3po_data.bulkCreate(
      ordersNotInZomato.map((record) => ({
        id: `ONI3_${record.pos_order_id}`,
        pos_order_id: record.pos_order_id,
        order_date: record.order_date,
        store_name: record.store_name,
        pos_net_amount: record.pos_net_amount,
        pos_tax_paid_by_customer: record.pos_tax_paid_by_customer,
        pos_commission_value: record.pos_commission_value,
        pos_pg_applied_on: record.pos_pg_applied_on,
        pos_pg_charge: record.pos_pg_charge,
        pos_taxes_zomato_fee: record.pos_taxes_zomato_fee,
        pos_tds_amount: record.pos_tds_amount,
        pos_final_amount: record.pos_final_amount,
        reconciled_status: record.reconciled_status,
        reconciled_amount: record.reconciled_amount,
        unreconciled_amount: record.unreconciled_amount,
        pos_vs_zomato_reason: record.pos_vs_zomato_reason,
        order_status_pos: record.order_status_pos,
        created_at: new Date(),
        updated_at: new Date(),
      })),
      { updateOnDuplicate: ["updated_at"] }
    );

    console.log("Successfully populated all sheet data tables");
    return true;
  } catch (error) {
    console.error("Error populating sheet data tables:", error);
    throw error;
  }
};

// Function to get sheet data
const getSheetData = async (req, res) => {
  try {
    const { sheet_type, start_date, end_date, store_codes } = req.query;
    let data;

    switch (sheet_type) {
      case "zomato_pos_vs_3po":
        data = await db.zomato_pos_vs_3po_data.findAll({
          where: {
            order_date:
              start_date === end_date
                ? start_date
                : { [Op.between]: [start_date, end_date] },
            store_name: { [Op.in]: store_codes },
          },
          order: [["order_date", "ASC"]],
        });
        break;
      case "zomato_3po_vs_pos":
        data = await db.zomato_3po_vs_pos_data.findAll({
          where: {
            order_date:
              start_date === end_date
                ? start_date
                : { [Op.between]: [start_date, end_date] },
            store_name: { [Op.in]: store_codes },
          },
          order: [["order_date", "ASC"]],
        });
        break;
      case "zomato_3po_vs_pos_refund":
        data = await db.zomato_3po_vs_pos_refund_data.findAll({
          where: {
            order_date:
              start_date === end_date
                ? start_date
                : { [Op.between]: [start_date, end_date] },
            store_name: { [Op.in]: store_codes },
          },
          order: [["order_date", "ASC"]],
        });
        break;
      case "orders_not_in_pos":
        data = await db.orders_not_in_pos_data.findAll({
          where: {
            order_date:
              start_date === end_date
                ? start_date
                : { [Op.between]: [start_date, end_date] },
            store_name: { [Op.in]: store_codes },
          },
          order: [["order_date", "ASC"]],
        });
        break;
      case "orders_not_in_3po":
        data = await db.orders_not_in_3po_data.findAll({
          where: {
            order_date:
              start_date === end_date
                ? start_date
                : { [Op.between]: [start_date, end_date] },
            store_name: { [Op.in]: store_codes },
          },
          order: [["order_date", "ASC"]],
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid sheet type",
        });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error getting sheet data:", error);
    res.status(500).json({
      success: false,
      message: "Error getting sheet data",
      error: error.message,
    });
  }
};

module.exports = {
  getSheetData,
  populateSheetDataTables,
};
