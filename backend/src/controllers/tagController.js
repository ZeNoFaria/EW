const Tag = require("../models/tagSchema");
const Entry = require("../models/entrySchema");

// Import logging function
let logSimpleAction;
try {
  const { logSimpleAction: logFn } = require("../middleware/logger");
  logSimpleAction = logFn;
  console.log("logSimpleAction imported successfully");
} catch (error) {
  console.error("Error importing logSimpleAction:", error.message);
  // Fallback to console.log
  logSimpleAction = async (
    userId,
    action,
    resourceType,
    resourceId,
    details
  ) => {
    console.log(
      `Action: ${action} by user ${userId} on ${resourceType} ${resourceId}`,
      details
    );
  };
}

// Get all tags with usage count (public route)
const getAllTags = async (req, res) => {
  try {
    const { limit = 50, search } = req.query;

    let filter = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const tags = await Tag.find(filter)
      .sort({ name: 1 })
      .limit(parseInt(limit));

    // Get usage count for each tag
    const tagsWithCount = await Promise.all(
      tags.map(async (tag) => {
        const countFilter = { tags: tag._id };
        // Only count public entries for non-authenticated users
        if (!req.user) {
          countFilter.isPublic = true;
        }

        const count = await Entry.countDocuments(countFilter);
        return {
          _id: tag._id,
          name: tag.name,
          count,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        };
      })
    );

    // Sort by usage count (descending)
    tagsWithCount.sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      tags: tagsWithCount,
      total: tagsWithCount.length,
    });
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tags",
    });
  }
};

// Get tag by ID (public route)
const getTagById = async (req, res) => {
  try {
    const { id } = req.params;

    const tag = await Tag.findById(id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    // Get entries that use this tag
    const entryFilter = { tags: id };
    if (!req.user) {
      entryFilter.isPublic = true;
    }

    const entries = await Entry.find(entryFilter)
      .populate("author", "username email")
      .populate("category", "name")
      .sort({ date: -1 })
      .limit(20);

    const count = await Entry.countDocuments(entryFilter);

    res.json({
      success: true,
      tag: {
        ...tag.toObject(),
        count,
        entries,
      },
    });
  } catch (error) {
    console.error("Error fetching tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tag",
    });
  }
};

// Create a new tag (authenticated route)
const createTag = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tag name is required",
      });
    }

    const trimmedName = name.trim();

    // Check if tag already exists (case-insensitive)
    const existingTag = await Tag.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });

    if (existingTag) {
      return res.status(409).json({
        success: false,
        message: "Tag already exists",
        tag: existingTag,
      });
    }

    const tag = new Tag({ name: trimmedName });
    await tag.save();

    // Log the action
    if (req.user && logSimpleAction) {
      await logSimpleAction(req.user._id, "create", "tag", tag._id, {
        name: tag.name,
      });
    }

    res.status(201).json({
      success: true,
      message: "Tag created successfully",
      tag,
    });
  } catch (error) {
    console.error("Error creating tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create tag",
    });
  }
};

// Update tag (authenticated route)
const updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tag name is required",
      });
    }

    const trimmedName = name.trim();

    // Check if another tag with this name exists
    const existingTag = await Tag.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      _id: { $ne: id },
    });

    if (existingTag) {
      return res.status(409).json({
        success: false,
        message: "Tag with this name already exists",
      });
    }

    const tag = await Tag.findByIdAndUpdate(
      id,
      { name: trimmedName },
      { new: true, runValidators: true }
    );

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    // Log the action
    if (req.user && logSimpleAction) {
      await logSimpleAction(req.user._id, "update", "tag", tag._id, {
        name: tag.name,
      });
    }

    res.json({
      success: true,
      message: "Tag updated successfully",
      tag,
    });
  } catch (error) {
    console.error("Error updating tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update tag",
    });
  }
};

// Delete tag (authenticated route)
const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;

    const tag = await Tag.findById(id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    // Remove tag from all entries that use it
    await Entry.updateMany({ tags: id }, { $pull: { tags: id } });

    await Tag.findByIdAndDelete(id);

    // Log the action
    if (req.user && logSimpleAction) {
      await logSimpleAction(req.user._id, "delete", "tag", id, {
        name: tag.name,
      });
    }

    res.json({
      success: true,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete tag",
    });
  }
};

// Find or create tags from array of names (utility function)
const findOrCreateTags = async (tagNames) => {
  if (!tagNames || !Array.isArray(tagNames)) {
    return [];
  }

  const tagIds = [];

  for (const tagName of tagNames) {
    const trimmedName = tagName.trim();
    if (!trimmedName) continue;

    try {
      // Find existing tag or create new one
      let tag = await Tag.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      });

      if (!tag) {
        tag = new Tag({ name: trimmedName });
        await tag.save();
        console.log(`Created new tag: ${trimmedName}`);
      }

      tagIds.push(tag._id);
    } catch (error) {
      console.error(`Error processing tag "${trimmedName}":`, error.message);
      // Continue with other tags even if one fails
    }
  }

  return tagIds;
};

// Debug: verificar se todas as funções estão definidas
console.log("=== TAG CONTROLLER FUNCTIONS ===");
console.log("getAllTags:", typeof getAllTags);
console.log("getTagById:", typeof getTagById);
console.log("createTag:", typeof createTag);
console.log("updateTag:", typeof updateTag);
console.log("deleteTag:", typeof deleteTag);
console.log("findOrCreateTags:", typeof findOrCreateTags);
console.log("=== END TAG CONTROLLER DEBUG ===");

module.exports = {
  getAllTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  findOrCreateTags,
};
