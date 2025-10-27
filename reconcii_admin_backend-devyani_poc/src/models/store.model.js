module.exports = (sequelize, Sequelize) => {
  const Store = sequelize.define(
    "store",
    {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      created_date: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      updated_date: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: "SYSTEM_GENERATED",
      },
      updated_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: "SYSTEM_GENERATED",
      },
      address: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      bandwidth: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      circuit_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      contact_number: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      eotf_status: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      fssai_licence_no: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      gst_no: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      isp: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      latitude: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      media: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      mfy_gd_store: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      oc: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      oc_email_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      oc_phone_no: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      om: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      om_email_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      om_phone_no: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      pin_code: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      rm: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      spod: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      store_code: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      store_mail_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      store_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      store_opening_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      store_status: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      store_type: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "store",
      timestamps: false, // Since we're managing timestamps manually
      charset: "utf8mb4",
      collate: "utf8mb4_0900_ai_ci",
    }
  );

  Store.associate = (models) => {
    Store.hasOne(models.zomato_mappings, {
      foreignKey: "store_code",
      sourceKey: "store_code",
    });
  };

  return Store;
};
