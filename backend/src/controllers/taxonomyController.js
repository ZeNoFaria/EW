const Taxonomy = require("../models/taxonomySchema");

// Criar categoria/tag
exports.createTaxonomy = async (req, res) => {
  try {
    const { name, description, parent, color, icon } = req.body;

    // Verificar se já existe
    const existing = await Taxonomy.findOne({
      name: new RegExp(`^${name}$`, "i"),
    });

    if (existing) {
      return res.status(400).json({ error: "Categoria já existe" });
    }

    // Gerar slug
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    // Calcular nível se tem parent
    let level = 0;
    if (parent) {
      const parentCategory = await Taxonomy.findById(parent);
      if (parentCategory) {
        level = parentCategory.level + 1;
      }
    }

    const taxonomy = new Taxonomy({
      name,
      slug,
      description,
      parent,
      level,
      color,
      icon,
    });

    await taxonomy.save();
    await taxonomy.populate("parent");

    res.status(201).json(taxonomy);
  } catch (error) {
    console.error("Error creating taxonomy:", error);
    res.status(500).json({ error: "Erro ao criar categoria" });
  }
};

// Listar todas as categorias (hierárquicas)
exports.getAllTaxonomies = async (req, res) => {
  try {
    const taxonomies = await Taxonomy.find({ isActive: true })
      .populate("parent")
      .sort({ level: 1, orderIndex: 1, name: 1 });

    // Organizar em árvore
    const buildTree = (categories, parentId = null) => {
      return categories
        .filter((cat) => {
          if (parentId === null) return !cat.parent;
          return (
            cat.parent && cat.parent._id.toString() === parentId.toString()
          );
        })
        .map((cat) => ({
          ...cat.toObject(),
          children: buildTree(categories, cat._id),
        }));
    };

    const tree = buildTree(taxonomies);
    res.json(tree);
  } catch (error) {
    console.error("Error fetching taxonomies:", error);
    res.status(500).json({ error: "Erro ao obter categorias" });
  }
};

// Obter categoria por slug
exports.getTaxonomyBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const taxonomy = await Taxonomy.findOne({ slug, isActive: true }).populate(
      "parent"
    );

    if (!taxonomy) {
      return res.status(404).json({ error: "Categoria não encontrada" });
    }

    res.json(taxonomy);
  } catch (error) {
    console.error("Error fetching taxonomy:", error);
    res.status(500).json({ error: "Erro ao obter categoria" });
  }
};

// Atualizar categoria
exports.updateTaxonomy = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.name) {
      updates.slug = updates.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }

    const taxonomy = await Taxonomy.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate("parent");

    if (!taxonomy) {
      return res.status(404).json({ error: "Categoria não encontrada" });
    }

    res.json(taxonomy);
  } catch (error) {
    console.error("Error updating taxonomy:", error);
    res.status(500).json({ error: "Erro ao atualizar categoria" });
  }
};

// Eliminar categoria
exports.deleteTaxonomy = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se tem filhos
    const children = await Taxonomy.find({ parent: id });
    if (children.length > 0) {
      return res.status(400).json({
        error: "Não é possível eliminar categoria com subcategorias",
      });
    }

    const taxonomy = await Taxonomy.findByIdAndDelete(id);
    if (!taxonomy) {
      return res.status(404).json({ error: "Categoria não encontrada" });
    }

    res.json({ message: "Categoria eliminada com sucesso" });
  } catch (error) {
    console.error("Error deleting taxonomy:", error);
    res.status(500).json({ error: "Erro ao eliminar categoria" });
  }
};

module.exports = {
  createTaxonomy: exports.createTaxonomy,
  getAllTaxonomies: exports.getAllTaxonomies,
  getTaxonomyBySlug: exports.getTaxonomyBySlug,
  updateTaxonomy: exports.updateTaxonomy,
  deleteTaxonomy: exports.deleteTaxonomy,
};
