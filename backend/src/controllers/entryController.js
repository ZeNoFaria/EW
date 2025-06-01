const Entry = require("../models/entrySchema");
const { findOrCreateTags } = require("./tagController");
const { logSimpleAction } = require("../middleware/logger");

// Get all entries
exports.getAllEntries = async (req, res) => {
  try {
    console.log("=== GET ALL ENTRIES DEBUG ===");
    console.log("User authenticated:", !!req.user);
    console.log("User ID:", req.user?._id);

    // ADICIONAR ESTE LOG PARA VER TODAS AS ENTRADAS
    const allEntries = await Entry.find({});
    console.log("Total entries in database:", allEntries.length);
    console.log(
      "All entries:",
      allEntries.map((e) => ({
        id: e._id,
        title: e.title,
        isPublic: e.isPublic,
        author: e.author,
      }))
    );

    const {
      page = 1,
      limit = 10,
      category,
      search,
      tag,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    // Build query
    let query = {};

    // Filter by visibility
    if (req.user) {
      // If user is authenticated, show:
      // 1. All public entries
      // 2. User's own entries (public or private)
      query = {
        $or: [{ isPublic: true }, { author: req.user._id }],
      };
      console.log("Authenticated user - showing public + own entries");
    } else {
      // If not authenticated, show only public entries
      query.isPublic = true;
      console.log("Unauthenticated user - showing only public entries");
    }

    // Add filters
    if (category) {
      query.category = category;
    }

    if (tag) {
      query.tags = { $in: [tag] };
    }

    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
        ],
      });
    }

    console.log("Query:", JSON.stringify(query, null, 2));

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get entries with population
    const entries = await Entry.find(query)
      .populate("author", "username email")
      .populate("category", "name description icon")
      .populate("tags", "name")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .limit(parseInt(limit))
      .skip(skip);

    console.log(`Found ${entries.length} entries`);

    // Get total count for pagination
    const total = await Entry.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const currentPage = parseInt(page);

    const pagination = {
      currentPage,
      totalPages,
      total,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    };

    // Log the action if user is authenticated
    if (req.user) {
      await logSimpleAction(req.user._id, "list", "entry", null, {
        count: entries.length,
        filters: { category, search, tag },
      });
    }

    res.status(200).json({
      success: true,
      entries,
      pagination,
    });
  } catch (error) {
    console.error("Error fetching entries:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch entries",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get entry by ID
exports.getEntryById = async (req, res) => {
  try {
    console.log("=== GET ENTRY BY ID DEBUG ===");
    console.log("Entry ID:", req.params.id);
    console.log("User authenticated:", !!req.user);
    console.log("User ID:", req.user?._id);
    console.log("Authorization header:", req.headers.authorization);

    const entry = await Entry.findById(req.params.id)
      .populate("author", "username email")
      .populate("category", "name description")
      .populate("tags", "name");

    if (!entry) {
      console.log("Entry not found");
      return res.status(404).json({
        success: false,
        message: "Entry not found",
      });
    }

    console.log("Entry found:");
    console.log("- Entry ID:", entry._id);
    console.log("- Entry author:", entry.author._id);
    console.log("- Entry isPublic:", entry.isPublic);
    console.log("- User ID:", req.user?._id);
    console.log(
      "- Is owner:",
      entry.author._id.toString() === req.user?._id.toString()
    );
    console.log("- Is admin:", req.user?.isAdmin);

    // Check access permissions
    if (
      !entry.isPublic &&
      (!req.user ||
        (entry.author._id.toString() !== req.user._id.toString() &&
          !req.user.isAdmin))
    ) {
      console.log("ACCESS DENIED - Reasons:");
      console.log("- Entry is not public:", !entry.isPublic);
      console.log("- User not authenticated:", !req.user);
      if (req.user) {
        console.log(
          "- Not owner:",
          entry.author._id.toString() !== req.user._id.toString()
        );
        console.log("- Not admin:", !req.user.isAdmin);
      }
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    console.log("ACCESS GRANTED");

    // Log the view if user is authenticated
    if (req.user) {
      await logSimpleAction(req.user._id, "view", "entry", entry._id, {
        title: entry.title,
      });
    }

    res.status(200).json({
      success: true,
      ...entry.toObject(),
    });
  } catch (error) {
    console.error("Error fetching entry:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch entry",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Create new entry
// Create new entry
exports.createEntry = async (req, res) => {
  try {
    console.log("=== CREATE ENTRY DEBUG ===");
    console.log("Request body:", req.body);
    console.log("User:", req.user?._id);

    const { title, content, date, category, tags, isPublic } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required",
      });
    }

    // Process tags
    const processedTags = await findOrCreateTags(tags || []);
    console.log("Processed tags:", processedTags);

    // Process isPublic - handle different input types
    let publicStatus = false;
    if (
      isPublic === true ||
      isPublic === "true" ||
      isPublic === "on" ||
      isPublic === "1"
    ) {
      publicStatus = true;
    }

    console.log("isPublic value received:", isPublic);
    console.log("Processed isPublic as:", publicStatus);

    // Create entry data
    const entryData = {
      title,
      content,
      author: req.user._id,
      date: date ? new Date(date) : new Date(),
      isPublic: publicStatus,
      category: category || null,
      tags: processedTags,
    };

    console.log(
      "Creating entry with data:",
      JSON.stringify(entryData, null, 2)
    );

    // Create the entry
    const entry = new Entry(entryData);
    await entry.save();

    console.log("Entry created successfully:", entry._id);
    console.log("Entry isPublic saved as:", entry.isPublic);

    // Populate the entry before returning
    await entry.populate("author", "username email");
    await entry.populate("category", "name description icon");
    await entry.populate("tags", "name");

    // Log the action
    await logSimpleAction(req.user._id, "create", "entry", entry._id, {
      title: entry.title,
    });

    res.status(201).json({
      success: true,
      _id: entry._id,
      message: "Entry created successfully",
    });
  } catch (error) {
    console.error("Error creating entry:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create entry",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update entry
exports.updateEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category, tags, date, isPublic } = req.body;

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Entry not found",
      });
    }

    // Check if user owns the entry (or is admin)
    if (
      entry.author.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own entries",
      });
    }

    const updateData = {};

    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (category !== undefined) updateData.category = category || null;
    if (date !== undefined) updateData.date = new Date(date);
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    // Process tags - convert tag names to ObjectIds
    if (tags !== undefined) {
      if (Array.isArray(tags) && tags.length > 0) {
        console.log("Processing tags for update:", tags);
        updateData.tags = await findOrCreateTags(tags);
      } else {
        updateData.tags = [];
      }
    }

    console.log(
      "Updating entry with data:",
      JSON.stringify(updateData, null, 2)
    );

    const updatedEntry = await Entry.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate([
      { path: "author", select: "username email" },
      { path: "category", select: "name description" },
      { path: "tags", select: "name" },
    ]);

    // Log the action
    await logSimpleAction(req.user._id, "update", "entry", updatedEntry._id, {
      title: updatedEntry.title,
    });

    res.status(200).json({
      success: true,
      message: "Entry updated successfully",
      ...updatedEntry.toObject(),
    });
  } catch (error) {
    console.error("Error updating entry:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update entry",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete entry
exports.deleteEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Entry not found",
      });
    }

    // Check if user owns the entry (or is admin)
    if (
      entry.author.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own entries",
      });
    }

    const deletedEntry = await Entry.findByIdAndDelete(id);

    // Log the action
    await logSimpleAction(req.user._id, "delete", "entry", id, {
      title: entry.title,
    });

    res.status(200).json({
      success: true,
      message: "Entry deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting entry:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete entry",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
