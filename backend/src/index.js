const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

// Import routes
const entryRoutes = require("./routes/entryRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URL =
  process.env.MONGO_URL || "mongodb://localhost:27017/mydatabase";

// Middleware
app.use(cors());
app.use(express.json());

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

// Routes
app.use("/api/entries", entryRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
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
const initializeData = async () => {
  try {
    const Category = require("./models/categorySchema");
    const Entry = require("./models/entrySchema");
    const Tag = require("./models/tagSchema");
    const User = require("./models/userSchema");
    const bcrypt = require("bcryptjs");

    const categoryCount = await Category.countDocuments();
    const userCount = await User.countDocuments();

    // Create admin user if none exists
    if (userCount === 0) {
      console.log("Creating admin user...");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("admin123", salt);

      try {
        await User.create({
          username: "admin",
          email: "admin@example.com",
          password: hashedPassword,
          isAdmin: true,
        });
        console.log(
          "Admin user created with username: admin, password: admin123"
        );
      } catch (err) {
        if (err.code === 11000) {
          console.log("Admin user already exists, skipping creation");
        } else {
          throw err;
        }
      }
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

      // Create entries
      await Entry.insertMany([
        {
          title: "Finished My Web Engineering Project",
          content:
            "Today I completed the final submission for my Web Engineering course. It was challenging but rewarding!",
          date: new Date("2025-05-04"),
          category: categories[0]._id,
          tags: [tags[0]._id],
        },
        {
          title: "10K Training Run",
          content:
            "Completed a 10K training run today in preparation for the upcoming marathon. Feeling great!",
          date: new Date("2025-05-01"),
          category: categories[1]._id,
          tags: [tags[1]._id],
        },
        {
          title: "Trip to the Mountains",
          content:
            "Spent the weekend hiking in the mountains with friends. The views were amazing!",
          date: new Date("2025-04-28"),
          category: categories[2]._id,
          tags: [tags[2]._id, tags[3]._id],
        },
      ]);

      console.log("Sample data initialized!");
    }
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
