// filepath: /home/diogo/Desktop/Uni/EngWeb/EW/backend/src/middleware/auth.js
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = require("../models/userSchema");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Middleware original (mantém compatibilidade)
exports.protect = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    res.status(500).json({ message: "Server error in auth middleware" });
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
