const db = require("../models");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const crypto = require("crypto-js");
const { sendEmail } = require("../utils/email");

const MAX_RESEND_COUNT = 3; // or 5, depending on your preference
const MAX_OTP_ATTEMPTS = 3;
const LOCKOUT_DURATION = 30; // minutes

const generateToken = (user) => {
  const jwtSecret = process.env.JWT_SECRET || "your-default-jwt-secret-key-for-development";
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "24h";
  
  console.log(`[JWT] Generating token with secret length: ${jwtSecret.length}, expires in: ${jwtExpiresIn}`);
  
  // Use the secret directly as a string, not base64 decoded
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role_name,
      organization: user.organization,
      name: user.name,
    },
    jwtSecret, // Use the secret directly
    { expiresIn: jwtExpiresIn }
  );
};

const login = async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  const startTime = Date.now();
  
  console.log(`[${requestId}] [LOGIN] API Request Started`, {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  try {
    const { username, password } = req.body;

    console.log(`[${requestId}] [LOGIN] Request Parameters`, {
      username,
      passwordLength: password ? password.length : 0,
      hasPassword: !!password
    });

    // Validate request
    if (!username || !password) {
      console.log(`[${requestId}] [LOGIN] Validation Failed`, {
        missingParams: {
          username: !username,
          password: !password
        }
      });
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    // Find user
    console.log(`[${requestId}] [LOGIN] Executing user lookup query`);
    const userQueryStart = Date.now();
    const user = await db.user_details.findOne({
      where: { username },
      include: [
        {
          model: db.organization,
          as: "organization",
          attributes: ["id", "status"],
          required: false, // Ensures LEFT JOIN
          on: {
            id: { [db.Sequelize.Op.col]: "user_details.organization_id" }, // Explicit join condition
          },
        },
      ],
    });
    const userQueryTime = Date.now() - userQueryStart;
    
    console.log(`[${requestId}] [LOGIN] User query completed in ${userQueryTime}ms`, {
      queryTime: userQueryTime,
      userFound: !!user,
      userId: user?.id,
      userActive: user?.active,
      organizationId: user?.organization_id,
      organizationStatus: user?.organization?.status,
      roleName: user?.role_name
    });

    if (!user) {
      console.log(`[${requestId}] [LOGIN] User not found`, { username });
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.active) {
      console.log(`[${requestId}] [LOGIN] User account inactive`, { userId: user.id, active: user.active });
      return res.status(401).json({
        message:
          "This account is inactive, please connect with your Account Admin.",
      });
    }

    // Check if organization is active
    if (!user.organization?.status && user?.role_name !== 0) {
      console.log(`[${requestId}] [LOGIN] Organization inactive`, { 
        organizationStatus: user.organization?.status, 
        roleName: user.role_name 
      });
      return res.status(401).json({
        message:
          "Your organization account is inactive, please connect with your Account Admin.",
      });
    }

    if (user.role_name === 2) {
      console.log(`[${requestId}] [LOGIN] Non-admin user attempted login`, { roleName: user.role_name });
      return res.status(401).json({
        message: "You are not an Admin User",
      });
    }

    // Verify password
    console.log(`[${requestId}] [LOGIN] Verifying password`);
    const passwordStart = Date.now();
    const isValidPassword = await bcrypt.compare(password, user.password);
    const passwordTime = Date.now() - passwordStart;
    
    console.log(`[${requestId}] [LOGIN] Password verification completed in ${passwordTime}ms`, {
      passwordTime: passwordTime,
      isValidPassword: isValidPassword
    });

    if (!isValidPassword) {
      console.log(`[${requestId}] [LOGIN] Invalid password`, { username });
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Check subscriptions is valid or not
    console.log(`[${requestId}] [LOGIN] Checking subscription status`);
    const subscriptionStart = Date.now();
    let subscriptionStatus = await validate_subscription(user.organization_id);
    const subscriptionTime = Date.now() - subscriptionStart;
    
    console.log(`[${requestId}] [LOGIN] Subscription check completed in ${subscriptionTime}ms`, {
      subscriptionTime: subscriptionTime,
      subscriptionStatus: subscriptionStatus
    });

    if (!subscriptionStatus) {
      console.log(`[${requestId}] [LOGIN] Subscription expired`);
      return res.status(401).json({
        message: "You're subscription has expired.",
      });
    }

    // Generate token
    console.log(`[${requestId}] [LOGIN] Generating JWT token`);
    const tokenStart = Date.now();
    const token = generateToken(user);
    const tokenTime = Date.now() - tokenStart;

    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] [LOGIN] Login successful`, {
      totalTime: totalTime,
      tokenTime: tokenTime,
      userId: user.id,
      username: user.username,
      role: user.role_name,
      organization: user.organization_id
    });

    res.json({
      status: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role_name,
        organization: user.organization_id,
        access_token: token,
        refresh_token: token, // Using same token for refresh for now
        name: user.name,
      }
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] [LOGIN] Login error:`, {
      error: error.message,
      stack: error.stack,
      totalTime: totalTime,
      requestId,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      message: "Error during login process",
    });
  }
};

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate request
    if (!username || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Check if user already exists
    const existingUser = await db.user_details.findOne({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
    });

    const token = generateToken(user);

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      token: token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Error during registration process",
    });
  }
};

const decrypt_token = (token) => {
  let decryptedData;
  try {
    const bytes = crypto.AES.decrypt(
      token,
      crypto.enc.Utf8.parse(process.env.SECRET_KEY),
      {
        iv: crypto.enc.Utf8.parse(process.env.IV),
        mode: crypto.mode.CBC,
        padding: crypto.pad.Pkcs7,
      }
    );
    decryptedData = JSON.parse(bytes.toString(crypto.enc.Utf8));
  } catch (error) {
    decryptedData = null;
  }
  return decryptedData;
};

const validate_subscription = async (organizationId) => {
  let status = false;
  let subscriptionData = await db.subscriptions.findOne({
    where: {
      organization_id: organizationId,
      tool_id: process.env.TOOL_ID || 1, // Default tool_id if not set
    },
  });
  
  if (subscriptionData) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date (ignore time)
    
    // First try to use direct start_date and end_date fields
    if (subscriptionData.start_date && subscriptionData.end_date) {
      const startDate = new Date(subscriptionData.start_date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(subscriptionData.end_date);
      endDate.setHours(23, 59, 59, 999); // Ensure the whole day is included
      
      console.log(`[SUBSCRIPTION] Direct date validation:`, {
        today: today.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isValid: today >= startDate && today <= endDate
      });
      
      if (today >= startDate && today <= endDate) {
        status = true;
      }
    }
    // Fallback to encrypted subscription_key if direct dates not available
    else if (subscriptionData?.subscription_key && subscriptionData.subscription_key !== 'invalid_key') {
      try {
        let decryptedData = decrypt_token(subscriptionData?.subscription_key);
        if (decryptedData?.start_date && decryptedData?.end_date) {
          const startDate = new Date(decryptedData.start_date);
          startDate.setHours(0, 0, 0, 0);

          const endDate = new Date(decryptedData.end_date);
          endDate.setHours(23, 59, 59, 999); // Ensure the whole day is included

          console.log(`[SUBSCRIPTION] Encrypted date validation:`, {
            today: today.toISOString(),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            isValid: today >= startDate && today <= endDate
          });

          if (today >= startDate && today <= endDate) {
            status = true;
          }
        }
      } catch (error) {
        console.log(`[SUBSCRIPTION] Failed to decrypt subscription key:`, error.message);
      }
    }
  }
  
  console.log(`[SUBSCRIPTION] Final validation result:`, { status, organizationId });
  return status;
};

const update_subscriptions = async () => {
  try {
    let reqBody = {
      organization_id: process.env.ORGANIZATION_ID,
      tool_id: process.env.TOOL_ID,
    };

    const newEncryptedToken = crypto.AES.encrypt(
      JSON.stringify(reqBody),
      crypto.enc.Utf8.parse(process.env.SECRET_KEY),
      {
        iv: crypto.enc.Utf8.parse(process.env.IV),
        mode: crypto.mode.CBC, // Explicitly set mode
        padding: crypto.pad.Pkcs7,
      }
    ).toString();
    try {
      const response = await axios.post(
        "https://licenseapi.corepeelers.com/api/auth/verify_subscriptions",
        {
          organization_id: process.env.ORGANIZATION_ID,
          tool_id: process.env.TOOL_ID,
        },
        {
          headers: {
            "api-key": newEncryptedToken,
          },
        }
      );
      if (response?.data?.success) {
        let decryptData = decrypt_token(response?.data?.token);
        if (decryptData) {
          await db.subscriptions.update(
            {
              start_date: decryptData?.start_date,
              end_date: decryptData?.end_date,
              subscription_key: response?.data?.token,
            },
            {
              where: {
                organization_id: process.env.ORGANIZATION_ID,
                tool_id: process.env.TOOL_ID,
              },
            }
          );
          let modulesIds = response?.data?.active_tools?.map(
            (module) => module?.module_id
          );
          await updateModules(
            process.env.ORGANIZATION_ID,
            [process.env.TOOL_ID],
            modulesIds
          );
        }
      }
    } catch (error) {
      if (error.status === 401) {
        await db.subscriptions.update(
          {
            subscription_key: "invalid_key",
          },
          {
            where: {
              organization_id: process.env.ORGANIZATION_ID,
              tool_id: process.env.TOOL_ID,
            },
          }
        );
      }
      console.error("Error calling API:", error.status);
    }

    console.log("success");
  } catch (error) {
    console.error("Error verifying subscription:", error);
  }
};

const updateModules = async (organization_id, toolIds, moduleIds) => {
  const tool_ids = toolIds.map((num) => parseInt(num, 10) || 0);
  const module_ids = moduleIds.map((num) => parseInt(num, 10) || 0);

  // Get existing tool assignments
  const existingAssignments = await db.organization_tool.findAll({
    where: { organization_id, tool_id: tool_ids[0] },
    attributes: ["tool_id", "module_id"],
  });

  // Create a mapping of existing assignments for easier lookup
  const existingMapping = {};
  existingAssignments.forEach((assignment) => {
    const key = `${assignment.tool_id}-${assignment.module_id}`;
    existingMapping[key] = true;
  });

  // Determine tools and modules to add and remove
  const newMappings = [];
  const toolIdsToRemove = [];

  tool_ids.forEach((tool_id) => {
    module_ids.forEach((module_id) => {
      const key = `${tool_id}-${module_id}`;
      if (!existingMapping[key]) {
        // If the combination doesn't exist, prepare to add it
        newMappings.push({
          organization_id,
          tool_id,
          module_id,
          created_by: 0,
        });
      }
    });
  });

  // Determine which existing assignments to remove
  existingAssignments.forEach((assignment) => {
    const key = `${assignment.tool_id}-${assignment.module_id}`;
    if (
      !tool_ids.includes(assignment.tool_id) ||
      !module_ids.includes(assignment.module_id)
    ) {
      toolIdsToRemove.push(key);
    }
  });

  // Create new assignments
  if (newMappings.length > 0) {
    try {
      await db.organization_tool.bulkCreate(newMappings);
    } catch (e) {
      console.log(e);
    }
  }

  // Remove old assignments
  if (toolIdsToRemove.length > 0) {
    const toolIdsToRemoveArray = toolIdsToRemove.map((key) => {
      const [tool_id, module_id] = key.split("-");
      return { tool_id, module_id };
    });
    await db.organization_tool.destroy({
      where: {
        organization_id,
        [db.Sequelize.Op.or]: toolIdsToRemoveArray.map(
          ({ tool_id, module_id }) => ({
            tool_id,
            module_id,
          })
        ),
      },
    });
  }
};

const forgotPasswordEndUser = async (req, res) => {
  try {
    const { username, email, resend } = req.body;

    // Validate request
    if (!username || !email) {
      return res.status(400).json({
        message: "Username and Email are required",
      });
    }

    // Find user
    const user = await db.user_details.findOne({
      where: { username, email },
    });

    if (!user) {
      return res.status(401).json({
        message: "No user found.",
      });
    }

    // Check if user is locked out due to too many failed attempts
    if (user.otp_attempts >= MAX_OTP_ATTEMPTS) {
      const lockoutTime = new Date(user.reset_otp_expires);
      const now = new Date();

      if (now < lockoutTime) {
        const minutesLeft = Math.ceil((lockoutTime - now) / (1000 * 60));
        return res.status(429).json({
          message: `Too many failed attempts. Please try again in ${minutesLeft} minutes or contact admin.`,
        });
      } else {
        // Reset attempts if lockout period is over
        await db.user_details.update(
          {
            otp_attempts: 0,
            otp_resend_count: 0,
          },
          {
            where: { id: user.id },
          }
        );
      }
    }

    // Check resend count if this is a resend request
    if (resend) {
      if (user.otp_resend_count >= MAX_RESEND_COUNT) {
        return res.status(429).json({
          message: `Maximum OTP resend limit (${MAX_RESEND_COUNT}) reached. Please contact admin.`,
        });
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Store OTP in database with expiration (15 minutes)
    try {
      await db.user_details.update(
        {
          reset_otp: otp,
          reset_otp_expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
          otp_resend_count: resend ? user.otp_resend_count + 1 : 0,
          otp_attempts: 0, // Reset attempts when new OTP is generated
        },
        {
          where: { id: user.id },
        }
      );
    } catch (e) {
      console.log(e);
    }

    // Send email with OTP
    await sendEmail({
      to: user.email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}. This OTP will expire in 15 minutes.
      \nRemaining resend attempts: ${
        MAX_RESEND_COUNT - (resend ? user.otp_resend_count + 1 : 0)
      }`,
    });

    res.json({
      success: true,
      message: "OTP has been sent to your email address",
      remainingResends:
        MAX_RESEND_COUNT - (resend ? user.otp_resend_count + 1 : 0),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      message: "Error during forgot password process",
    });
  }
};

// Add this new function to verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { username, email, otp } = req.body;

    const user = await db.user_details.findOne({
      where: { username, email },
    });

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    // Check if user is locked out
    if (user.otp_attempts >= MAX_OTP_ATTEMPTS) {
      const lockoutTime = new Date(user.reset_otp_expires);
      const now = new Date();

      if (now < lockoutTime) {
        const minutesLeft = Math.ceil((lockoutTime - now) / (1000 * 60));
        return res.status(429).json({
          message: `Too many failed attempts. Please try again in ${minutesLeft} minutes or contact admin.`,
        });
      }
    }

    // Check if OTP is expired
    if (new Date() > new Date(user.reset_otp_expires)) {
      return res.status(401).json({
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP
    if (user.reset_otp !== otp) {
      // Increment attempts and update lockout if necessary
      const newAttempts = (user.otp_attempts || 0) + 1;
      const updates = {
        otp_attempts: newAttempts,
      };

      if (newAttempts >= MAX_OTP_ATTEMPTS) {
        updates.reset_otp_expires = new Date(
          Date.now() + LOCKOUT_DURATION * 60 * 1000
        );
      }

      await db.user_details.update(updates, {
        where: { id: user.id },
      });

      return res.status(401).json({
        message: "Invalid OTP",
        remainingAttempts: MAX_OTP_ATTEMPTS - newAttempts,
      });
    }

    // OTP is valid - reset attempts and proceed
    await db.user_details.update(
      {
        reset_otp: null,
        reset_otp_expires: null,
        otp_attempts: 0,
        otp_resend_count: 0,
      },
      {
        where: { id: user.id },
      }
    );

    res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      message: "Error during OTP verification",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { username, email, newPassword } = req.body;

    // Validate request
    if (!username || !email || !newPassword) {
      return res.status(400).json({
        message: "Username, email and new password are required",
      });
    }

    // Find user
    const user = await db.user_details.findOne({
      where: { username, email },
    });

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    // Check if OTP was verified (reset_otp should be null after successful verification)
    if (user.reset_otp !== null) {
      return res.status(401).json({
        message: "Please verify OTP before resetting password",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.user_details.update(
      {
        password: hashedPassword,
        // Reset all OTP related fields just in case
        reset_otp: null,
        reset_otp_expires: null,
        otp_attempts: 0,
        otp_resend_count: 0,
      },
      {
        where: { id: user.id },
      }
    );

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      message: "Error during password reset process",
    });
  }
};

module.exports = {
  login,
  register,
  update_subscriptions,
  forgotPasswordEndUser,
  verifyOTP,
  resetPassword,
};
