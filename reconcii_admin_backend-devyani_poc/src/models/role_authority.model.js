const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('role_authority', {
    role_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'role',
        key: 'id'
      }
    },
    authority_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'authority',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'role_authority',
    timestamps: false,
    indexes: [
      {
        name: "FK_role_role_id",
        using: "BTREE",
        fields: [
          { name: "role_id" },
        ]
      },
      {
        name: "FK_role_authority_id",
        using: "BTREE",
        fields: [
          { name: "authority_id" },
        ]
      },
    ]
  });
};
