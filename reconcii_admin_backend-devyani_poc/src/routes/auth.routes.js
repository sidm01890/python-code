const express = require("express");
const router = express.Router();
const {
  login,
  register,
  update_subscriptions,
  forgotPasswordEndUser,
  verifyOTP,
  resetPassword,
} = require("../controllers/auth.controller");

// Middleware for logging all auth route requests
router.use((req, res, next) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  req.requestId = requestId;
  
  console.log(`[${requestId}] [AUTH_ROUTE] ${req.method} ${req.path}`, {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    contentType: req.get('Content-Type'),
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  
  next();
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input
 */
router.post("/register", register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", login);
router.post("/auth/access/token", login); // Alias for frontend compatibility
router.post("/update_subscriptions", update_subscriptions);
router.post("/end_user/forgot_password", forgotPasswordEndUser);
router.post("/end_user/verify_otp", verifyOTP);
router.post("/end_user/reset_password", resetPassword);

// Catch-all route for unmatched auth requests
router.all("*", (req, res) => {
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  
  console.log(`[${requestId}] [AUTH_ROUTE] 404 - Route not found`, {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    body: req.body
  });
  
  res.status(404).json({
    message: "Auth route not found",
    availableRoutes: [
      "POST /api/auth/login",
      "POST /api/auth/register", 
      "POST /api/auth/auth/access/token",
      "POST /api/auth/update_subscriptions",
      "POST /api/auth/end_user/forgot_password",
      "POST /api/auth/end_user/verify_otp",
      "POST /api/auth/end_user/reset_password"
    ]
  });
});

module.exports = router;
