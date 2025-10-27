const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PosVsTrmSummary = sequelize.define(
    "pos_vs_trm_summary",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      pos_transaction_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      trm_transaction_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      pos_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      trm_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      pos_store: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      trm_store: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      pos_mode_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      acquirer: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      payment_mode: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      card_issuer: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      card_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      card_network: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      card_colour: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      pos_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      trm_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      reconciled_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      unreconciled_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      reconciliation_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      pos_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      trm_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: true,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: true,
      },
    },
    {
      tableName: "pos_vs_trm_summary",
      timestamps: false, // Since we're handling timestamps manually
      indexes: [
        {
          name: "ix_pos_vs_trm_summary_pos_transaction_id",
          fields: ["pos_transaction_id"],
        },
        {
          name: "ix_pos_vs_trm_summary_trm_transaction_id",
          fields: ["trm_transaction_id"],
        },
        {
          name: "ix_pos_vs_trm_summary_reconciliation_status",
          fields: ["reconciliation_status"],
        },
      ],
    }
  );

  return PosVsTrmSummary;
};
