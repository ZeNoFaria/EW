const SIP = require("../models/sipSchema");
const multer = require("multer");
const AdmZip = require("adm-zip");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");

// Configuração do multer para upload de ZIP
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/temp/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.zip`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed"));
    }
  },
});

// Função para calcular checksum
const calculateChecksum = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = require("fs").createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
};

// Validar manifesto
const validateManifesto = (manifesto) => {
  const required = ["metadata"];
  const metadataRequired = ["dataCreacao", "titulo", "tipo"];

  for (let field of required) {
    if (!manifesto[field]) {
      throw new Error(
        `Campo obrigatório '${field}' não encontrado no manifesto`
      );
    }
  }

  for (let field of metadataRequired) {
    if (!manifesto.metadata[field]) {
      throw new Error(
        `Campo obrigatório 'metadata.${field}' não encontrado no manifesto`
      );
    }
  }

  return true;
};

// Ingestão de SIP
exports.ingestSIP = [
  upload.single("sipFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "Nenhum ficheiro ZIP foi enviado" });
      }

      const zipPath = req.file.path;
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();

      // Procurar manifesto
      const manifestoEntry = zipEntries.find(
        (entry) =>
          entry.entryName === "manifesto-SIP.json" ||
          entry.entryName === "manifesto-SIP.xml"
      );

      if (!manifestoEntry) {
        await fs.unlink(zipPath);
        return res
          .status(400)
          .json({
            error:
              "Manifesto SIP não encontrado (manifesto-SIP.json ou manifesto-SIP.xml)",
          });
      }

      // Ler e validar manifesto
      let manifesto;
      try {
        const manifestoContent = manifestoEntry.getData().toString("utf8");

        if (manifestoEntry.entryName.endsWith(".json")) {
          manifesto = JSON.parse(manifestoContent);
        } else {
          // TODO: Implementar parsing XML se necessário
          throw new Error("Suporte XML ainda não implementado");
        }

        validateManifesto(manifesto);
      } catch (error) {
        await fs.unlink(zipPath);
        return res
          .status(400)
          .json({ error: `Erro no manifesto: ${error.message}` });
      }

      // Criar entrada SIP na base de dados
      const sipData = {
        metadata: {
          ...manifesto.metadata,
          dataCreacao: new Date(manifesto.metadata.dataCreacao),
          produtor: req.user._id,
          submitter: req.user._id,
        },
        sipInfo: {
          originalFilename: req.file.originalname,
          manifestoValid: true,
        },
        status: "processing",
      };

      const sip = new SIP(sipData);
      await sip.save();

      // Processar ficheiros
      const processedFiles = [];
      const sipDir = path.join("uploads/sips", sip._id.toString());
      await fs.mkdir(sipDir, { recursive: true });

      for (let entry of zipEntries) {
        if (
          entry.entryName !== manifestoEntry.entryName &&
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
        message: "SIP ingerido com sucesso",
        sipId: sip._id,
        processedFiles: processedFiles.length,
      });
    } catch (error) {
      console.error("Erro na ingestão SIP:", error);

      // Limpar ficheiro temporário em caso de erro
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error("Erro ao limpar ficheiro temporário:", cleanupError);
        }
      }

      res.status(500).json({ error: "Erro interno no processamento do SIP" });
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
