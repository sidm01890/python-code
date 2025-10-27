const db = require("../models");
const { Op } = require("sequelize");

// Get all cities
const getAllCities = async (req, res) => {
  try {
    const cities = await db.devyani_city.findAll({
      order: [["city_name", "ASC"]],
      attributes: ["id", "city_id", "city_name"],
    });

    res.json({
      success: true,
      data: cities,
    });
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cities",
    });
  }
};

// Get stores by multiple cities
const getStoresByCities = async (req, res) => {
  try {
    const { startDate, endDate, cities } = req.body;

    if (!cities || cities.length < 1) {
      return res.status(400).json({
        success: false,
        message: "At least one city ID is required",
      });
    }

    let cityIdsMaps = cities?.map((city) => city?.city_id || city);

    console.log("cityIdsMaps", cityIdsMaps);

    const whereClause = {
      city_id: { [Op.in]: cityIdsMaps },
    };

    // Add date filters if provided
    // if (startDate && endDate) {
    //   whereClause.created_at = {
    //     [Op.between]: [startDate, endDate],
    //   };
    // }

    const stores = await db.devyani_store.findAll({
      where: whereClause,
      order: [["store_name", "ASC"]],
      attributes: [
        "id",
        ["store_code", "code"],
        "sap_code",
        "store_name",
        "city_id",
      ],
    });

    // Add posDataSync field to each store
    const storesWithSync = stores.map((store) => ({
      ...store.toJSON(),
      posDataSync: true,
    }));

    res.json({
      success: true,
      data: storesWithSync,
    });
  } catch (error) {
    console.error("Error fetching stores:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stores",
    });
  }
};

module.exports = {
  getAllCities,
  getStoresByCities,
};
