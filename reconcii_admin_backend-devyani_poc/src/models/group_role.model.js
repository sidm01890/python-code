const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('group_role', {
    group_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'groupss',
        key: 'id'
      }
    },
    role_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'role',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'group_role',
    timestamps: false,
    indexes: [
      {
        name: "FK_gr_group_id",
        using: "BTREE",
        fields: [
          { name: "group_id" },
        ]
      },
      {
        name: "FK_gr_role_id",
        using: "BTREE",
        fields: [
          { name: "role_id" },
        ]
      },
    ]
  });
};
