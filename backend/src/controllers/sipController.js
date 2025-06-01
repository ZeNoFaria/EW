const SIP = require("../models/sipSchema");
const Category = require("../models/categorySchema");
const Tag = require("../models/tagSchema");
const mongoose = require("mongoose");
const multer = require("multer");
const AdmZip = require("adm-zip");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");

// ADICIONAR - Configuração do multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/temp/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/zip",
      "application/x-zip-compressed",
      "application/x-tar",
      "application/gzip",
      "application/x-7z-compressed",
    ];

    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.match(/\.(zip|tar|tar\.gz|7z)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos ZIP, TAR, TAR.GZ ou 7Z são permitidos"));
    }
  },
});

// ADICIONAR - Função para calcular checksum (se não existir)
const calculateChecksum = async (filePath) => {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
};

// ADICIONAR - Função para validar manifesto (se não existir)
const validateManifesto = (manifesto) => {
  if (!manifesto.metadata) {
    throw new Error("Manifesto deve conter seção 'metadata'");
  }

  if (!manifesto.metadata.titulo) {
    throw new Error("Manifesto deve conter 'metadata.titulo'");
  }

  // Outras validações conforme necessário
  return true;
};

// NOVA FUNÇÃO - Processar metadados do formulário
const processFormMetadata = async (formData, userId) => {
  const processedMetadata = {
    produtor: userId,
    submitter: userId,
    dataCreacao: new Date(),
  };

  // Processar título
  if (formData.titulo) {
    processedMetadata.titulo = formData.titulo.trim();
  }

  // Processar descrição
  if (formData.descricao) {
    processedMetadata.descricao = formData.descricao.trim();
  }

  // Processar tipo (converter string para ObjectId)
  if (formData.tipo) {
    if (mongoose.Types.ObjectId.isValid(formData.tipo)) {
      // Já é um ObjectId válido
      processedMetadata.tipo = formData.tipo;
    } else {
      // É uma string, tentar encontrar ou criar categoria
      let categoria = await Category.findOne({
        name: { $regex: new RegExp(`^${formData.tipo}$`, "i") },
      });

      if (!categoria) {
        // Criar nova categoria (usando apenas os campos do seu schema)
        categoria = new Category({
          name: formData.tipo,
          description: `Auto-created category for ${formData.tipo}`,
          icon: "📄", // Ícone padrão
        });
        await categoria.save();
        console.log(`Nova categoria criada: ${categoria.name}`);
      }

      processedMetadata.tipo = categoria._id;
    }
  }

  // Processar tags (converter strings para ObjectIds)
  if (formData.tags) {
    const tagIds = [];
    let tagNames = [];

    // Processar diferentes formatos de tags
    if (Array.isArray(formData.tags)) {
      // Se já é um array
      tagNames = formData.tags
        .map((tag) => tag.toString().trim())
        .filter((tag) => tag);
    } else if (typeof formData.tags === "string") {
      // Se é uma string separada por vírgulas
      tagNames = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);
    }

    // Converter cada tag para ObjectId
    for (const tagName of tagNames) {
      if (mongoose.Types.ObjectId.isValid(tagName)) {
        // Já é um ObjectId
        tagIds.push(tagName);
      } else {
        // É uma string, encontrar ou criar tag
        let tag = await Tag.findOne({
          name: { $regex: new RegExp(`^${tagName}$`, "i") },
        });

        if (!tag) {
          // Criar nova tag (usando apenas os campos do seu schema)
          tag = new Tag({
            name: tagName,
          });
          await tag.save();
          console.log(`Nova tag criada: ${tag.name}`);
        }

        tagIds.push(tag._id);
      }
    }

    processedMetadata.tags = tagIds;
  }

  // Processar visibilidade
  if (formData.isPublic !== undefined) {
    processedMetadata.isPublic =
      formData.isPublic === "true" || formData.isPublic === true;
  }

  return processedMetadata;
};

// NOVA FUNÇÃO - Processar metadados do manifesto
const processManifestMetadata = async (manifestoMetadata, userId) => {
  console.log("=== processManifestMetadata INICIADA ===");
  console.log("manifestoMetadata recebida:", manifestoMetadata);

  const processedMetadata = {
    ...manifestoMetadata, // Manter todos os campos originais
    produtor: userId,
    submitter: userId,
    dataCreacao: new Date(manifestoMetadata.dataCreacao) || new Date(),
  };

  // Processar tipo (converter string para ObjectId)
  if (manifestoMetadata.tipo && typeof manifestoMetadata.tipo === "string") {
    console.log("Processando tipo do manifesto:", manifestoMetadata.tipo);

    let categoria = await Category.findOne({
      name: { $regex: new RegExp(`^${manifestoMetadata.tipo}$`, "i") },
    });

    if (!categoria) {
      console.log("Categoria não encontrada, criando nova...");
      categoria = new Category({
        name: manifestoMetadata.tipo,
        description: `Auto-created category for ${manifestoMetadata.tipo}`,
        icon: "🏷️",
      });
      await categoria.save();
      console.log(
        `Nova categoria criada: ${categoria.name} (${categoria._id})`
      );
    }

    processedMetadata.tipo = categoria._id;
    console.log("Tipo convertido para ObjectId:", processedMetadata.tipo);
  }

  // Processar tags (converter strings para ObjectIds)
  if (manifestoMetadata.tags && Array.isArray(manifestoMetadata.tags)) {
    console.log("Processando tags do manifesto:", manifestoMetadata.tags);

    const tagIds = [];

    for (const tagName of manifestoMetadata.tags) {
      if (typeof tagName === "string") {
        let tag = await Tag.findOne({
          name: { $regex: new RegExp(`^${tagName}$`, "i") },
        });

        if (!tag) {
          console.log(`Tag não encontrada, criando: ${tagName}`);
          tag = new Tag({
            name: tagName,
          });
          await tag.save();
          console.log(`Nova tag criada: ${tag.name} (${tag._id})`);
        }

        tagIds.push(tag._id);
        console.log(`Tag processada: ${tagName} -> ${tag._id}`);
      } else if (mongoose.Types.ObjectId.isValid(tagName)) {
        tagIds.push(tagName);
      }
    }

    processedMetadata.tags = tagIds;
    console.log("Tags convertidas para ObjectIds:", processedMetadata.tags);
  }

  console.log("=== processManifestMetadata CONCLUÍDA ===");
  console.log("Resultado:", processedMetadata);

  return processedMetadata;
};

// CORRIGIR - Função principal de ingestão
exports.ingestSIP = [
  upload.single("sipFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Nenhum ficheiro ZIP foi enviado",
        });
      }

      console.log("=== INGESTÃO SIP INICIADA ===");
      console.log("Dados do formulário recebidos:", req.body);
      console.log("Arquivo recebido:", req.file.originalname);

      const zipPath = req.file.path;
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();

      // Procurar manifesto
      const manifestoEntry = zipEntries.find(
        (entry) =>
          entry.entryName === "manifesto-SIP.json" ||
          entry.entryName === "manifesto-SIP.xml"
      );

      let manifestoMetadata = {};

      if (manifestoEntry) {
        try {
          const manifestoContent = manifestoEntry.getData().toString("utf8");

          if (manifestoEntry.entryName.endsWith(".json")) {
            const manifesto = JSON.parse(manifestoContent);
            console.log("Manifesto encontrado:", manifesto);

            // PROCESSAR METADADOS DO MANIFESTO
            manifestoMetadata = await processManifestMetadata(
              manifesto.metadata || {},
              req.user._id
            );
          } else {
            console.warn("Suporte XML ainda não implementado");
          }
        } catch (error) {
          console.error("Erro ao processar manifesto:", error);
          await fs.unlink(zipPath);
          return res.status(400).json({
            success: false,
            error: `Erro no manifesto: ${error.message}`,
          });
        }
      }

      // PROCESSAR DADOS DO FORMULÁRIO (se existirem)
      let formMetadata = {};
      const hasFormData = Object.keys(req.body).length > 0;

      if (hasFormData) {
        try {
          console.log("Processando dados do formulário...");
          formMetadata = await processFormMetadata(req.body, req.user._id);
          console.log("Metadados do formulário processados:", formMetadata);
        } catch (metadataError) {
          console.error(
            "Erro ao processar metadados do formulário:",
            metadataError
          );
          await fs.unlink(zipPath);
          return res.status(400).json({
            success: false,
            error: `Erro nos metadados: ${metadataError.message}`,
          });
        }
      }

      // COMBINAR METADADOS (formulário tem prioridade sobre manifesto)
      const finalMetadata = {
        ...manifestoMetadata, // Manifesto como base
        ...formMetadata, // Formulário sobrescreve manifesto
        dataCreacao:
          formMetadata.dataCreacao ||
          manifestoMetadata.dataCreacao ||
          new Date(),
      };

      console.log("=== METADATA FINAL ===");
      console.log("Manifesto:", manifestoMetadata);
      console.log("Formulário:", formMetadata);
      console.log("Final:", finalMetadata);

      // VERIFICAR SE OS TIPOS ESTÃO CORRETOS
      if (finalMetadata.tipo) {
        console.log(
          "Tipo final:",
          finalMetadata.tipo,
          "isObjectId:",
          mongoose.Types.ObjectId.isValid(finalMetadata.tipo)
        );
      }
      if (finalMetadata.tags) {
        console.log(
          "Tags final:",
          finalMetadata.tags,
          "isArray:",
          Array.isArray(finalMetadata.tags)
        );
        if (Array.isArray(finalMetadata.tags)) {
          finalMetadata.tags.forEach((tag, index) => {
            console.log(
              `tag[${index}]:`,
              tag,
              "isObjectId:",
              mongoose.Types.ObjectId.isValid(tag)
            );
          });
        }
      }

      // Criar entrada SIP na base de dados
      const sipData = {
        metadata: finalMetadata,
        sipInfo: {
          originalFilename: req.file.originalname,
          manifestoValid: !!manifestoEntry,
          hasFormData: hasFormData,
        },
        status: "processing",
        isPublic: finalMetadata.isPublic || false,
      };

      console.log("=== CRIANDO SIP ===");
      console.log("sipData completo:", JSON.stringify(sipData, null, 2));

      const sip = new SIP(sipData);
      await sip.save();

      // Processar ficheiros
      const processedFiles = [];
      const sipDir = path.join("uploads/sips", sip._id.toString());
      await fs.mkdir(sipDir, { recursive: true });

      for (let entry of zipEntries) {
        if (
          entry.entryName !== manifestoEntry?.entryName &&
          !entry.isDirectory
        ) {
          const fileBuffer = entry.getData();
          const storedName = `${Date.now()}-${entry.entryName}`;
          const filePath = path.join(sipDir, storedName);

          await fs.writeFile(filePath, fileBuffer);

          const checksum = await calculateChecksum(filePath);

          processedFiles.push({
            originalName: entry.entryName,
            storedName: storedName,
            path: filePath,
            mimetype:
              require("mime-types").lookup(entry.entryName) ||
              "application/octet-stream",
            size: fileBuffer.length,
            checksum: checksum,
          });
        }
      }

      // Atualizar SIP com ficheiros processados
      sip.files = processedFiles;
      sip.status = "ingested";
      sip.processingLogs.push({
        level: "info",
        message: `SIP processado com sucesso. ${processedFiles.length} ficheiros armazenados.`,
      });

      await sip.save();

      // Limpar ficheiro ZIP temporário
      await fs.unlink(zipPath);

      res.status(201).json({
        success: true,
        message: "SIP ingerido com sucesso",
        sipId: sip._id,
        aipId: sip._id,
        processedFiles: processedFiles.length,
        metadata: finalMetadata,
      });
    } catch (error) {
      console.error("=== ERRO NA INGESTÃO SIP ===");
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if (error.errors) {
        console.error("Validation errors:", error.errors);
      }

      // Limpar ficheiro temporário
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error("Erro ao limpar ficheiro temporário:", cleanupError);
        }
      }

      // Retornar erro detalhado
      let errorMessage = "Erro interno no processamento do SIP";

      if (error.name === "ValidationError") {
        errorMessage =
          "Dados inválidos: " +
          Object.values(error.errors)
            .map((e) => e.message)
            .join(", ");
      } else if (error.message) {
        errorMessage = error.message;
      }

      res.status(500).json({
        success: false,
        error: errorMessage,
        message: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },
];
// Listar AIPs
exports.getAllAIPs = async (req, res) => {
  try {
    const { page = 1, limit = 10, tipo, isPublic } = req.query;

    const filter = { status: "ingested" };
    if (tipo) filter["metadata.tipo"] = tipo;
    if (isPublic !== undefined) filter.isPublic = isPublic === "true";

    // Se não for admin, só mostra públicos ou próprios
    if (req.user.role !== "admin") {
      filter.$or = [{ isPublic: true }, { "metadata.produtor": req.user._id }];
    }

    const aips = await SIP.find(filter)
      .populate("metadata.produtor", "username email")
      .populate("metadata.submitter", "username email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await SIP.countDocuments(filter);

    res.json({
      aips,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Erro ao listar AIPs:", error);
    res.status(500).json({ error: "Erro ao listar AIPs" });
  }
};

exports.getAIPs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      tipo,
      isPublic,
      search,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = { status: "ingested" };

    // Se não for admin, só pode ver os seus próprios ou públicos
    if (req.user.role !== "admin") {
      filter.$or = [{ "metadata.produtor": req.user._id }, { isPublic: true }];
    }

    if (tipo) {
      filter["metadata.tipo"] = tipo;
    }

    if (isPublic !== undefined) {
      filter.isPublic = isPublic === "true";
    }

    if (search) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { "metadata.titulo": { $regex: search, $options: "i" } },
          { "metadata.descricao": { $regex: search, $options: "i" } },
          { "metadata.localizacao": { $regex: search, $options: "i" } },
        ],
      });
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === "desc" ? -1 : 1;

    const aips = await SIP.find(filter)
      .populate("metadata.produtor", "username email")
      .populate("metadata.submitter", "username email")
      .populate("metadata.tipo", "name slug color icon")
      .populate("metadata.tags", "name slug color")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SIP.countDocuments(filter);

    res.json({
      aips,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    });
  } catch (error) {
    console.error("Erro ao obter AIPs:", error);
    res.status(500).json({ error: "Erro ao obter AIPs" });
  }
};

// Obter AIP por ID
exports.getAIPById = async (req, res) => {
  try {
    const aip = await SIP.findById(req.params.id)
      .populate("metadata.produtor", "username email")
      .populate("metadata.submitter", "username email");

    if (!aip) {
      return res.status(404).json({ error: "AIP não encontrado" });
    }

    // Verificar permissões
    if (
      !aip.isPublic &&
      req.user.role !== "admin" &&
      !aip.metadata.produtor._id.equals(req.user._id)
    ) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    res.json(aip);
  } catch (error) {
    console.error("Erro ao obter AIP:", error);
    res.status(500).json({ error: "Erro ao obter AIP" });
  }
};

// Atualizar visibilidade do AIP
exports.updateAIPVisibility = async (req, res) => {
  try {
    const { isPublic } = req.body;

    const aip = await SIP.findById(req.params.id);

    if (!aip) {
      return res.status(404).json({ error: "AIP não encontrado" });
    }

    // Verificar permissões
    if (
      req.user.role !== "admin" &&
      !aip.metadata.produtor.equals(req.user._id)
    ) {
      return res
        .status(403)
        .json({ error: "Sem permissão para alterar este AIP" });
    }

    aip.isPublic = isPublic;
    aip.processingLogs.push({
      level: "info",
      message: `Visibilidade alterada para ${isPublic ? "público" : "privado"}`,
    });

    await aip.save();

    res.json({ message: "Visibilidade atualizada com sucesso", aip });
  } catch (error) {
    console.error("Erro ao atualizar visibilidade:", error);
    res.status(500).json({ error: "Erro ao atualizar visibilidade" });
  }
};

module.exports = exports;
