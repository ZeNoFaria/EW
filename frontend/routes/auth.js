var express = require("express");
var router = express.Router();
var axios = require("axios");

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

// Site configuration
const siteConfig = {
  siteName: "My Digital Diary",
  title: "Digital Diary",
};

// Navigation items
const navItems = [
  { text: "Homepage", url: "/", active: false },
  { text: "Timeline", url: "/timeline", active: false },
  { text: "Categories", url: "/categories", active: false },
  { text: "Tags", url: "/tags", active: false },
  { text: "About", url: "/about", active: false },
];

const getNavWithActive = (activeUrl) => {
  return navItems.map((item) => ({
    ...item,
    active: item.url === activeUrl,
  }));
};

// GET login page
router.get("/login", (req, res) => {
  const error = req.query.error;
  const message = req.query.message;

  res.render("login", {
    ...siteConfig,
    title: "Login - Digital Diary",
    navItems: getNavWithActive(null),
    error: error || null,
    message: message || null,
  });
});

// GET register page
router.get("/register", (req, res) => {
  const error = req.query.error;
  const message = req.query.message;

  res.render("register", {
    ...siteConfig,
    title: "Register - Digital Diary",
    navItems: getNavWithActive(null),
    error: error || null,
    message: message || null,
  });
});

// POST login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect("/auth/login?error=Please fill in all fields");
    }

    const response = await axios.post(`${API_URL}/api/auth/login`, {
      username,
      password,
    });

    // Store token in session or cookie
    req.session.token = response.data.token;
    req.session.user = response.data.user;

    res.redirect("/?message=Login successful");
  } catch (error) {
    console.error("Login error:", error.response?.data || error.message);

    const errorMessage = error.response?.data?.message || "Login failed";
    res.redirect(`/auth/login?error=${encodeURIComponent(errorMessage)}`);
  }
});

// POST register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.redirect("/auth/register?error=Please fill in all fields");
    }

    if (password !== confirmPassword) {
      return res.redirect("/auth/register?error=Passwords do not match");
    }

    const response = await axios.post(`${API_URL}/api/auth/register`, {
      username,
      email,
      password,
    });

    // Store token in session
    req.session.token = response.data.token;
    req.session.user = response.data.user;

    res.redirect("/?message=Registration successful");
  } catch (error) {
    console.error("Registration error:", error.response?.data || error.message);

    const errorMessage = error.response?.data?.message || "Registration failed";
    res.redirect(`/auth/register?error=${encodeURIComponent(errorMessage)}`);
  }
});

// GET logout
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.redirect("/?message=Logged out successfully");
  });
});

// OAuth routes - redirect to backend
router.get("/google", (req, res) => {
  res.redirect(`${API_URL}/api/auth/google`);
});

router.get("/facebook", (req, res) => {
  res.redirect(`${API_URL}/api/auth/facebook`);
});

// OAuth success callback
router.get("/success", (req, res) => {
  const token = req.query.token;

  if (token) {
    // TODO: Decode token to get user info
    req.session.token = token;
    res.redirect("/?message=Login successful");
  } else {
    res.redirect("/auth/login?error=Authentication failed");
  }
});

// OAuth error callback
router.get("/error", (req, res) => {
  const message = req.query.message || "Authentication failed";
  res.redirect(`/auth/login?error=${encodeURIComponent(message)}`);
});

// Profile page
router.get("/profile", async (req, res) => {
  try {
    if (!req.session.token) {
      return res.redirect("/auth/login?error=Please login first");
    }

    const response = await axios.get(`${API_URL}/api/auth/profile`, {
      headers: {
        Authorization: `Bearer ${req.session.token}`,
      },
    });

    res.render("profile", {
      ...siteConfig,
      title: "Profile - Digital Diary",
      navItems: getNavWithActive(null),
      user: response.data,
    });
  } catch (error) {
    console.error("Profile error:", error.response?.data || error.message);

    // Token might be expired
    req.session.destroy();
    res.redirect("/auth/login?error=Session expired, please login again");
  }
});

module.exports = router;
