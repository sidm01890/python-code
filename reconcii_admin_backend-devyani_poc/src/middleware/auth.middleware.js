const jwt = require("jsonwebtoken");
const db = require("../models");
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    console.log(`[AUTH_MIDDLEWARE] Token validation for ${req.method} ${req.path}`, {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      authorization: req.headers.authorization ? 'Bearer ***' : 'none'
    });

    if (!token) {
      console.log(`[AUTH_MIDDLEWARE] No token provided for ${req.method} ${req.path}`);
      return res.status(401).json({ message: "No token provided" });
    }

    // Use the same secret format as token generation
    const jwtSecret = process.env.JWT_SECRET || "your-default-jwt-secret-key-for-development";
    const decoded = jwt.verify(
      token,
      jwtSecret // Use the secret directly, not base64 decoded
    );

    console.log(`[AUTH_MIDDLEWARE] Token decoded successfully`, {
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role
    });

    let user = {};
    if (decoded?.jti) {
      user = await db.user_details.findOne({
        where: { username: decoded?.jti },
      });
    } else {
      user = await db.user_details.findByPk(decoded.id);
    }

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // if (!user.isActive) {
    //   return res.status(401).json({ message: "User is inactive" });
    // }

    req.user = user;
    next();
  } catch (error) {
    console.log("error", JSON.stringify(error));
    return res.status(401).json({ message: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  next();
  // if (req.user && req.user.role === "admin") {
  //   next();
  // } else {
  //   res.status(403).json({ message: "Require Admin Role!" });
  // }
};

module.exports = {
  verifyToken,
  isAdmin,
};
