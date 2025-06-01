const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = require("../models/userSchema");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Middleware original (mantém compatibilidade)
exports.protect = async (req, res, next) => {
  try {
    console.log("=== AUTH MIDDLEWARE DEBUG ===");
    console.log("Authorization header:", req.headers.authorization);

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      try {
        // Get token from header
        token = req.headers.authorization.split(" ")[1];
        console.log("Extracted token:", token ? "EXISTS" : "NOT FOUND");

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log("Decoded token:", decoded);

        // Get user from the token
        req.user = await User.findById(decoded.id).select("-password");
        console.log(
          "Found user:",
          req.user
            ? {
                id: req.user._id,
                username: req.user.username,
                isAdmin: req.user.isAdmin,
              }
            : "NOT FOUND"
        );

        if (!req.user) {
          console.log("User not found in database");
          return res.status(401).json({
            success: false,
            message: "Not authorized, user not found",
          });
        }

        console.log("User authenticated successfully");
        next();
      } catch (error) {
        console.error("Token verification error:", error);
        return res.status(401).json({
          success: false,
          message: "Not authorized, token failed",
        });
      }
    } else {
      console.log("No authorization header or invalid format");
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token",
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};

// Middleware opcional (não requer autenticação)
exports.optionalAuth = async (req, res, next) => {
  try {
    console.log("=== OPTIONAL AUTH DEBUG ===");
    console.log("Authorization header:", req.headers.authorization);

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      try {
        token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = await User.findById(decoded.id).select("-password");
        console.log(
          "Optional auth successful, user:",
          req.user ? req.user.username : "not found"
        );
      } catch (error) {
        console.log(
          "Optional auth failed, continuing without user:",
          error.message
        );
      }
    } else {
      console.log("No auth header, continuing without user");
    }

    next();
  } catch (error) {
    console.error("Optional auth error:", error);
    next();
  }
};

// Middleware usando Passport JWT (alternativo)
exports.passportProtect = passport.authenticate("jwt", { session: false });

// Middleware para verificar se é admin
exports.admin = (req, res, next) => {
  if (req.user && (req.user.isAdmin || req.user.role === "admin")) {
    next();
  } else {
    res.status(403).json({ message: "Admin access required" });
  }
};

// Middleware para verificar se o user é dono do recurso ou admin
exports.ownerOrAdmin = (resourceUserIdField = "userId") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const isAdmin = req.user.isAdmin || req.user.role === "admin";
    const isOwner =
      req.user._id.toString() === req.params[resourceUserIdField] ||
      req.user._id.toString() === req.body[resourceUserIdField];

    if (isAdmin || isOwner) {
      next();
    } else {
      res
        .status(403)
        .json({ message: "Access denied. Owner or admin required." });
    }
  };
};
