module.exports = (sequelize, Sequelize) => {
  const ZomatoMappings = sequelize.define(
    "zomato_mappings",
    {
      zomato_store_code: {
        type: Sequelize.STRING(45),
        primaryKey: true,
        allowNull: false,
      },
      store_code: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "zomato_mappings",
      timestamps: false, // Since we're managing timestamps manually
      charset: "utf8mb4",
      collate: "utf8mb4_0900_ai_ci",
      indexes: [
        {
          name: "ix_zomato_mappings_zomato_store_code",
          fields: ["zomato_store_code"],
        },
      ],
    }
  );

  // Define association with Store model
  ZomatoMappings.associate = function (models) {
    ZomatoMappings.belongsTo(models.store, {
      foreignKey: "store_code",
      targetKey: "store_code",
    });
  };

  return ZomatoMappings;
};
