// filepath: /home/diogo/Desktop/Uni/EngWeb/EW/backend/src/controllers/entryController.js
const Entry = require("../models/entrySchema");

// Get all entries
exports.getAllEntries = async (req, res) => {
  try {
    const entries = await Entry.find()
      .populate("category")
      .populate("tags")
      .sort({ date: -1 });
    res.status(200).json(entries);
  } catch (error) {
    console.error("Error fetching entries:", error);
    res.status(500).json({ message: "Failed to fetch entries" });
  }
};

// Get entry by ID
exports.getEntryById = async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id)
      .populate("category")
      .populate("tags");

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    res.status(200).json(entry);
  } catch (error) {
    console.error("Error fetching entry:", error);
    res.status(500).json({ message: "Failed to fetch entry" });
  }
};

// Create new entry
exports.createEntry = async (req, res) => {
  try {
    const newEntry = new Entry(req.body);
    const savedEntry = await newEntry.save();
    res.status(201).json(savedEntry);
  } catch (error) {
    console.error("Error creating entry:", error);
    res.status(500).json({ message: "Failed to create entry" });
  }
};

// Update entry
exports.updateEntry = async (req, res) => {
  try {
    const updatedEntry = await Entry.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedEntry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    res.status(200).json(updatedEntry);
  } catch (error) {
    console.error("Error updating entry:", error);
    res.status(500).json({ message: "Failed to update entry" });
  }
};

// Delete entry
exports.deleteEntry = async (req, res) => {
  try {
    const deletedEntry = await Entry.findByIdAndDelete(req.params.id);

    if (!deletedEntry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    res.status(200).json({ message: "Entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting entry:", error);
    res.status(500).json({ message: "Failed to delete entry" });
  }
};
