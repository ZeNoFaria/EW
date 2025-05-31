const SIP = require("../models/sipSchema");
const AdmZip = require("adm-zip");
const path = require("path");
const fs = require("fs").promises;

// Exportar DIP (ZIP similar ao SIP original)
exports.exportDIP = async (req, res) => {
  try {
    const aipId = req.params.id;

    const aip = await SIP.findOne({
      _id: aipId,
      status: "ingested",
    }).populate(
      "metadata.produtor metadata.submitter metadata.tipo metadata.tags"
    );

    if (!aip) {
      return res.status(404).json({ error: "AIP não encontrado" });
    }

    // Verificar permissões
    if (
      !aip.isPublic &&
      aip.metadata.produtor._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ error: "Sem permissão para exportar este AIP" });
    }

    const zip = new AdmZip();

    // Criar manifesto DIP
    const dipManifest = {
      type: "DIP",
      exportedAt: new Date().toISOString(),
      exportedBy: req.user._id,
      originalAIP: aip._id,
      metadata: aip.metadata,
      files: aip.files.map((file) => ({
        originalName: file.originalName,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
      })),
    };

    zip.addFile(
      "manifesto-DIP.json",
      Buffer.from(JSON.stringify(dipManifest, null, 2), "utf8")
    );

    // Adicionar ficheiros
    for (const file of aip.files) {
      const filePath = path.join(process.cwd(), "uploads", file.path);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath, "files/", file.originalName);
      }
    }

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="DIP_${aip.metadata.titulo.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${aip._id}.zip"`,
    });

    res.send(zip.toBuffer());
  } catch (error) {
    console.error("Erro ao exportar DIP:", error);
    res.status(500).json({ error: "Erro ao exportar DIP" });
  }
};

// Servir ficheiro individual de um AIP
exports.serveFile = async (req, res) => {
  try {
    const { id, fileId } = req.params;

    const aip = await SIP.findById(id);

    if (!aip) {
      return res.status(404).json({ error: "AIP não encontrado" });
    }

    // Verificar permissões
    if (
      !aip.isPublic &&
      req.user.role !== "admin" &&
      !aip.metadata.produtor.equals(req.user._id)
    ) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const file = aip.files.find((f) => f._id.toString() === fileId);

    if (!file) {
      return res.status(404).json({ error: "Ficheiro não encontrado" });
    }

    // Verificar se ficheiro existe no filesystem
    try {
      await fs.access(file.path);
    } catch {
      return res
        .status(404)
        .json({ error: "Ficheiro não disponível no sistema" });
    }

    res.set({
      "Content-Type": file.mimetype,
      "Content-Disposition": `inline; filename="${file.originalName}"`,
    });

    res.sendFile(path.resolve(file.path));
  } catch (error) {
    console.error("Erro ao servir ficheiro:", error);
    res.status(500).json({ error: "Erro ao servir ficheiro" });
  }
};

module.exports = exports;
