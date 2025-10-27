const User = require("../models/user.model");

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await User.findByPk(req.user.id);

    await user.update({
      username: username || user.username,
      email: email || user.email,
    });

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating profile" });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
