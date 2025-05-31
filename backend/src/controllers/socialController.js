const User = require("../models/userSchema");
const SIP = require("../models/sipSchema");

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

const generateSocialShareLinks = (aip) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3001";
  const aipUrl = `${baseUrl}/public/aips/${aip._id}`;
  const title = encodeURIComponent(aip.metadata.titulo);
  const description = encodeURIComponent(aip.metadata.descricao || "");

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${aipUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${aipUrl}&text=${title}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${aipUrl}`,
    whatsapp: `https://wa.me/?text=${title}%20${aipUrl}`,
  };
};

exports.getSocialLinks = async (req, res) => {
  try {
    const aip = await SIP.findOne({
      _id: req.params.id,
      isPublic: true,
    });

    if (!aip) {
      return res.status(404).json({ error: "AIP público não encontrado" });
    }

    const socialLinks = generateSocialShareLinks(aip);
    res.json(socialLinks);
  } catch (error) {
    console.error("Erro ao gerar links sociais:", error);
    res.status(500).json({ error: "Erro ao gerar links sociais" });
  }
};
