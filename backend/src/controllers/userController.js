// backend/src/controllers/userController.js
const User = require("../models/userSchema");

// Administração de utilizadores (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar utilizadores" });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, isAdmin: role === "admin" },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar utilizador" });
  }
};
