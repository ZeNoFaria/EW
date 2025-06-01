const express = require("express");
const path = require("path");
const session = require("express-session");
const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");

const app = express();

// Configure Pug template engine
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Static files middleware
app.use(express.static(path.join(__dirname, "public")));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Middleware to make user info available in all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.token;
  next();
});

// Routes
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/api", require("./routes/api"));
app.use("/archive", require("./routes/archive"));
app.use("/", indexRouter);

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).render("error", {
    siteName: "My Digital Diary",
    navItems: [],
    message: "Page not found",
    error: { status: 404 },
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).render("error", {
    siteName: "My Digital Diary",
    navItems: [],
    message: "Something went wrong!",
    error: { status: err.status || 500 },
  });
});

module.exports = app;
