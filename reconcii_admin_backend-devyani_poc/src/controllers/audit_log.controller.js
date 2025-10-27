const db = require("../models");

const createLog = async (req, res) => {
  try {
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0] || // Get real IP if behind a proxy
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip;

    await db.audit_log.create({
      ...req.body,
      system_ip: clientIp, // Add the client's IP address here
    });
    res.status(201).json({ success: true });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error creating tool" });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    let { startDate, endDate, username, action } = req.body;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Set to end of the day
      endDate = end;
    }
    let where = {
      created_at: {
        [db.Sequelize.Op.between]: [new Date(startDate), new Date(endDate)], // Filter logs between startDate and endDate
      },
    };
    if (username) {
      where = { ...where, username };
    } else if (req.user?.role_name === 2) {
      where = { ...where, username: req.user?.username };
    }
    if (action) {
      where = { ...where, action };
    }

    const logs = await db.audit_log.findAll({
      attributes: [
        "id",
        "username",
        "user_email",
        "system_ip",
        "role",
        "action",
        "action_details",
        "request",
        "remarks",
        "created_at",
      ],
      where: where,
      order: [["id", "DESC"]],
      include: [
        {
          model: db.user_details,
          attributes: ["id", "username", "name"],
          as: "user_details",
          required: true,
          on: {
            username: { [db.Sequelize.Op.col]: "audit_log.username" }, // Explicit join condition
          },
          where: {
            organization_id: req.user?.dataValues?.organization_id,
          },
        },
      ],
    });

    res.status(200).json({
      message: "Activity logs fetched successfully",
      status: 200,
      Data: logs,
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error fetching activity logs" });
  }
};

const getAllOrganizationUsers = async (req, res) => {
  try {
    let organization_id = req.user?.dataValues?.organization_id;
    const queryOptions = {
      attributes: {
        exclude: [
          "password",
          "raw_password",
          "created_by",
          "updated_by",
          "updated_date",
          "user_label",
          "role_name",
          "refresh_token",
          "parent_username",
          "level",
          "access_token",
          "created_date",
        ],
      },
      where: { organization_id },
      include: [
        {
          model: db.groups,
          as: "groups",
          required: false, // Ensures LEFT JOIN
          on: {
            id: { [db.Sequelize.Op.col]: "user_details.group_id" }, // Explicit join condition
          },
        },
      ],
    };

    const users = await db.user_details.findAll(queryOptions);
    res.status(200).json({
      Message: "Users fetched successfully",
      Status: 200,
      Data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

module.exports = {
  createLog,
  getAuditLogs,
  getAllOrganizationUsers,
};
