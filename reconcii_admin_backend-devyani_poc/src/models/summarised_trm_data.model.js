const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const SummarisedTrmData = sequelize.define(
    "summarised_trm_data",
    {
      trm_uid: {
        type: DataTypes.STRING(625),
        primaryKey: true,
        allowNull: false,
      },
      trm_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      store_name: {
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
      transaction_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      transaction_type_detail: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      transaction_date: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      rrn: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      cloud_ref_id: {
        type: DataTypes.STRING(255),
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
      tableName: "summarised_trm_data",
      timestamps: false, // Since we're handling timestamps manually
      indexes: [
        {
          name: "ix_summarised_trm_data_transaction_id",
          fields: ["transaction_id"],
        },
        {
          name: "ix_summarised_trm_data_trm_uid",
          fields: ["trm_uid"],
        },
        {
          name: "ix_summarised_trm_data_cloud_ref_id",
          fields: ["cloud_ref_id"],
        },
      ],
    }
  );

  return SummarisedTrmData;
};
