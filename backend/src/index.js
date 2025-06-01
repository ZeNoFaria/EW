const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

// Import passport configuration
require("./config/passport");
const passport = require("passport");

// Import routes
const entryRoutes = require("./routes/entryRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const authRoutes = require("./routes/authRoutes");
const sipRoutes = require("./routes/sipRoutes");
const commentRoutes = require("./routes/commentRoutes");
const publicRoutes = require("./routes/publicRoutes");
const adminRoutes = require("./routes/adminRoutes");
const timelineRoutes = require("./routes/timelineRoutes");
const taxonomyRoutes = require("./routes/taxonomyRoutes");
const newsRoutes = require("./routes/newsRoutes");
const userRoutes = require("./routes/userRoutes");
const socialRoutes = require("./routes/socialRoutes");
const tagRoutes = require("./routes/tagRoutes");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URL =
  process.env.MONGO_URL || "mongodb://localhost:27017/mydatabase";

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  })
);
app.use(express.json());

// Session configuration for OAuth
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

console.log("Environment check:", {
  JWT_SECRET: process.env.JWT_SECRET ? "LOADED" : "NOT_LOADED",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "LOADED" : "NOT_LOADED",
});

// Connect to MongoDB with improved connection options
mongoose
  .connect(MONGO_URL, {
    serverSelectionTimeoutMS: 30000, // Timeout after 30 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    retryWrites: true,
    waitQueueTimeoutMS: 15000, // Timeout as server doesn't respond to writes
  })
  .then(() => {
    console.log("Connected to MongoDB");
    // Only initialize data after successful connection
    initializeData();
  })
  .catch((err) => console.error("Error connecting to MongoDB:", err));

//Routes
app.use("/api/entries", entryRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sip", sipRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/taxonomy", taxonomyRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/tags", tagRoutes);

app.use(
  "/api-docs",
  (req, res, next) => {
    swaggerSpec.openapi = "3.0.0";
    req.swaggerDoc = swaggerSpec;
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      authAction: {
        bearerAuth: {
          name: "bearerAuth",
          schema: {
            type: "apiKey",
            in: "header",
            name: "Authorization",
            description:
              "Enter your bearer token in the format: Bearer <token>",
          },
          value: "Bearer ",
        },
      },
    },
  })
);

// Test route
app.get("/", (req, res) => {
  res.send("Digital Diary API is running");
});

// Initialize with sample data if database is empty
// Initialize with sample data if database is empty
const initializeData = async () => {
  try {
    const Category = require("./models/categorySchema");
    const Entry = require("./models/entrySchema");
    const Tag = require("./models/tagSchema");
    const User = require("./models/userSchema");
    const Taxonomy = require("./models/taxonomySchema");
    const bcrypt = require("bcryptjs");

    const categoryCount = await Category.countDocuments();
    const userCount = await User.countDocuments();
    const taxonomyCount = await Taxonomy.countDocuments();
    const entryCount = await Entry.countDocuments();

    let adminUser;

    // Create admin user if none exists
    if (userCount === 0) {
      console.log("Creating admin user...");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("admin123", salt);

      try {
        adminUser = await User.create({
          username: "admin",
          email: "admin@example.com",
          password: hashedPassword,
          isAdmin: true,
          role: "admin",
          provider: "local",
        });
        console.log(
          "Admin user created with username: admin, password: admin123"
        );
      } catch (err) {
        if (err.code === 11000) {
          console.log("Admin user already exists, skipping creation");
          adminUser = await User.findOne({ username: "admin" });
        } else {
          throw err;
        }
      }
    } else {
      // Get existing admin user
      adminUser = await User.findOne({ username: "admin" });
      if (!adminUser) {
        adminUser = await User.findOne({ isAdmin: true });
      }
    }

    if (taxonomyCount === 0) {
      console.log("Inicializando taxonomias básicas...");

      await Taxonomy.insertMany([
        {
          name: "Viagem",
          slug: "viagem",
          description: "Viagens e experiências turísticas",
          color: "#28a745",
          icon: "fas fa-plane",
          level: 0,
        },
        {
          name: "Desporto",
          slug: "desporto",
          description: "Atividades desportivas e exercício",
          color: "#007bff",
          icon: "fas fa-running",
          level: 0,
        },
        {
          name: "Trabalho",
          slug: "trabalho",
          description: "Atividades profissionais",
          color: "#6c757d",
          icon: "fas fa-briefcase",
          level: 0,
        },
        {
          name: "Pessoal",
          slug: "pessoal",
          description: "Vida pessoal e momentos especiais",
          color: "#dc3545",
          icon: "fas fa-heart",
          level: 0,
        },
        {
          name: "Educação",
          slug: "educacao",
          description: "Estudos e aprendizagem",
          color: "#ffc107",
          icon: "fas fa-graduation-cap",
          level: 0,
        },
      ]);

      console.log("Taxonomias básicas criadas!");
    }

    if (categoryCount === 0) {
      console.log("Initializing database with sample data...");

      // Create categories
      const categories = await Category.insertMany([
        {
          name: "Academic",
          icon: "📚",
          description: "School and education related entries",
        },
        {
          name: "Sports",
          icon: "🏃‍♂️",
          description: "Sports and fitness activities",
        },
        {
          name: "Travel",
          icon: "✈️",
          description: "Trips and travel experiences",
        },
        {
          name: "Personal",
          icon: "💭",
          description: "Personal thoughts and reflections",
        },
      ]);

      // Create tags
      const tags = await Tag.insertMany([
        { name: "Achievement" },
        { name: "Running" },
        { name: "Hiking" },
        { name: "Photos" },
      ]);

      console.log("Categories and tags created!");
    }

    // Create sample entries if none exist and we have an admin user
    if (entryCount === 0 && adminUser) {
      console.log("Creating sample entries...");

      // Get existing categories and tags
      const categories = await Category.find();
      const tags = await Tag.find();

      if (categories.length > 0 && tags.length > 0) {
        await Entry.insertMany([
          {
            title: "Finished My Web Engineering Project",
            content:
              "Today I completed the final submission for my Web Engineering course. It was challenging but rewarding!",
            date: new Date("2025-05-04"),
            category: categories[0]._id,
            tags: [tags[0]._id],
            author: adminUser._id,
            isPublic: true,
          },
          {
            title: "10K Training Run",
            content:
              "Completed a 10K training run today in preparation for the upcoming marathon. Feeling great!",
            date: new Date("2025-05-01"),
            category: categories[1]._id,
            tags: [tags[1]._id],
            author: adminUser._id,
            isPublic: true,
          },
          {
            title: "Trip to the Mountains",
            content:
              "Spent the weekend hiking in the mountains with friends. The views were amazing!",
            date: new Date("2025-04-28"),
            category: categories[2]._id,
            tags: [tags[2]._id, tags[3]._id],
            author: adminUser._id,
            isPublic: true,
          },
          {
            title: "Learning Docker and Kubernetes",
            content:
              "Started a new course on containerization technologies. Docker seems very powerful for development workflows.",
            date: new Date("2025-05-02"),
            category: categories[0]._id,
            tags: [tags[0]._id],
            author: adminUser._id,
            isPublic: false,
          },
          {
            title: "Personal Reflection",
            content:
              "Taking some time to reflect on my goals and what I want to achieve this year. Setting new priorities.",
            date: new Date("2025-04-30"),
            category: categories[3]._id,
            tags: [],
            author: adminUser._id,
            isPublic: false,
          },
        ]);

        console.log("Sample entries created!");
      } else {
        console.log("No categories or tags found, skipping entry creation");
      }
    }

    console.log("Sample data initialization completed!");
  } catch (error) {
    console.error("Error initializing data:", error);
  }
};

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `API Documentation available at http://localhost:${PORT}/api-docs`
  );
});
