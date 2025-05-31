const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const User = require("../models/userSchema");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      isAdmin: user.isAdmin,
      role: user.role || (user.isAdmin ? "admin" : "user"),
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Format user response
const formatUserResponse = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  isAdmin: user.isAdmin,
  role: user.role || (user.isAdmin ? "admin" : "user"),
  provider: user.provider,
  avatar: user.avatar,
});

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User with that email or username already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      provider: "local",
    });

    await newUser.save();

    // Generate JWT token
    const token = generateToken(newUser);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: formatUserResponse(newUser),
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user registered via OAuth
    if (user.provider !== "local") {
      return res.status(401).json({
        message: `Please login using ${user.provider}`,
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(formatUserResponse(user));
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error fetching profile" });
  }
};

// OAuth success callback
exports.oauthSuccess = (req, res) => {
  try {
    const token = generateToken(req.user);

    // Redirect to frontend with token
    const frontendURL = process.env.FRONTEND_URL || "http://localhost:3001";
    res.redirect(`${frontendURL}/auth/success?token=${token}`);
  } catch (error) {
    console.error("OAuth success error:", error);
    const frontendURL = process.env.FRONTEND_URL || "http://localhost:3001";
    res.redirect(`${frontendURL}/auth/error?message=Authentication failed`);
  }
};

// OAuth failure callback
exports.oauthFailure = (req, res) => {
  const frontendURL = process.env.FRONTEND_URL || "http://localhost:3001";
  res.redirect(`${frontendURL}/auth/error?message=Authentication failed`);
};
