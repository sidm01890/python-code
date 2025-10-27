const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('merchant_details', {
    id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: "name"
    },
    access_key: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: "access_key"
    },
    secret_key: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: "secret_key"
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    access_token_validity: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    refresh_token_validity: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    access_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    refresh_token: {
      type: DataTypes.STRING(255),
      allowNull: true
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
    tableName: 'merchant_details',
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
        name: "name",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "name" },
        ]
      },
      {
        name: "access_key",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "access_key" },
        ]
      },
      {
        name: "secret_key",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "secret_key" },
        ]
      },
    ]
  });
};
