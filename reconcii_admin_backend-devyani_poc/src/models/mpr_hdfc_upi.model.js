module.exports = (sequelize, DataTypes) => {
  const MprHdfcUpi = sequelize.define(
    "mpr_hdfc_upi",
    {
      uid: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
        unique: true,
      },
      external_mid: { type: DataTypes.STRING(255), allowNull: true },
      external_tid: { type: DataTypes.STRING(255), allowNull: true },
      upi_merchant_id: { type: DataTypes.STRING(255), allowNull: true },
      merchant_name: { type: DataTypes.STRING(255), allowNull: true },
      merchant_vpa: { type: DataTypes.STRING(255), allowNull: true },
      payer_vpa: { type: DataTypes.STRING(255), allowNull: true },
      upi_trxn_id: { type: DataTypes.STRING(255), allowNull: true },
      order_id: { type: DataTypes.STRING(255), allowNull: true },
      customer_ref_no: { type: DataTypes.STRING(255), allowNull: true },
      transaction_req_date: { type: DataTypes.DATE, allowNull: true },
      settlement_date: { type: DataTypes.DATE, allowNull: true },
      currency: { type: DataTypes.STRING(255), allowNull: true },
      transaction_amount: { type: DataTypes.DOUBLE, allowNull: true },
      msf_amount: { type: DataTypes.DOUBLE, allowNull: true },
      cgst_amt: { type: DataTypes.DOUBLE, allowNull: true },
      sgst_amt: { type: DataTypes.DOUBLE, allowNull: true },
      igst_amt: { type: DataTypes.DOUBLE, allowNull: true },
      utgst_amt: { type: DataTypes.DOUBLE, allowNull: true },
      net_amount: { type: DataTypes.DOUBLE, allowNull: true },
      gst_invoice_no: { type: DataTypes.STRING(255), allowNull: true },
      trans_type: { type: DataTypes.STRING(255), allowNull: true },
      pay_type: { type: DataTypes.STRING(255), allowNull: true },
      cr_dr: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      tableName: "mpr_hdfc_upi",
      timestamps: false,
    }
  );
  return MprHdfcUpi;
};
