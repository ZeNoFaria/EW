const Category = require("../models/categorySchema.js");
const Entry = require("../models/entrySchema.js");

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();

    // For each category, count the number of entries
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Entry.countDocuments({ category: category._id });
        return {
          ...category.toObject(),
          entryCount: count,
        };
      })
    );

    res.status(200).json(categoriesWithCount);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Get entries for this category
    const entries = await Entry.find({ category: category._id })
      .populate("tags")
      .sort({ date: -1 });

    res.status(200).json({
      category,
      entries,
      entryCount: entries.length,
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ message: "Failed to fetch category" });
  }
};

// Create category
exports.createCategory = async (req, res) => {
  try {
    const newCategory = new Category(req.body);
    const savedCategory = await newCategory.save();
    res.status(201).json(savedCategory);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ message: "Failed to create category" });
  }
};

// Other CRUD operations for categories
exports.updateCategory = async (req, res) => {
  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Failed to update category" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Also update entries that had this category
    await Entry.updateMany(
      { category: req.params.id },
      { $unset: { category: 1 } }
    );

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Failed to delete category" });
  }
};
