const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "dynamic_formulas",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      report_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Name of the report this formula belongs to",
      },
      tender: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Tender type for which formula is applicable",
      },
      formula_for: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Purpose or target of the formula",
      },
      formula_text: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "The actual formula text/expression",
      },
      formula_parts: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "JSON structure containing parts/components of the formula",
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      sequelize,
      tableName: "dynamic_formulas",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "report_tender_idx",
          using: "BTREE",
          fields: [{ name: "report_name" }, { name: "tender" }],
        },
      ],
    }
  );
};
