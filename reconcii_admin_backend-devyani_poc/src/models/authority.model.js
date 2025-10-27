const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('authority', {
    id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    authority_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: "authority_name"
    },
    resource_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    service_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'service',
        key: 'id'
      }
    },
    created_date: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_date: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    tableName: 'authority',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "authority_name",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "authority_name" },
        ]
      },
      {
        name: "FK_authority_service_id",
        using: "BTREE",
        fields: [
          { name: "service_id" },
        ]
      },
    ]
  });
};
