const SIP = require("../models/sipSchema");
const AdmZip = require("adm-zip");
const path = require("path");
const fs = require("fs").promises;

// Exportar DIP (ZIP similar ao SIP original)
exports.exportDIP = async (req, res) => {
  try {
    const aip = await SIP.findById(req.params.id).populate(
      "metadata.produtor",
      "username email"
    );

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

    const zip = new AdmZip();

    // Criar manifesto DIP
    const dipManifesto = {
      metadata: {
        ...aip.metadata,
        dataExportacao: new Date().toISOString(),
        exportadoPor: req.user.username,
        versao: "1.0",
      },
      files: aip.files.map((file) => ({
        nome: file.originalName,
        tipo: file.mimetype,
        tamanho: file.size,
        checksum: file.checksum,
      })),
      estatisticas: {
        totalFicheiros: aip.files.length,
        tamanhoTotal: aip.files.reduce((sum, file) => sum + file.size, 0),
      },
    };

    // Adicionar manifesto ao ZIP
    zip.addFile(
      "manifesto-DIP.json",
      Buffer.from(JSON.stringify(dipManifesto, null, 2))
    );

    // Adicionar ficheiros ao ZIP
    for (let file of aip.files) {
      try {
        const fileBuffer = await fs.readFile(file.path);
        zip.addFile(file.originalName, fileBuffer);
      } catch (fileError) {
        console.error(`Erro ao ler ficheiro ${file.originalName}:`, fileError);
        // Continuar com outros ficheiros
      }
    }

    // Preparar resposta
    const zipBuffer = zip.toBuffer();
    const filename = `DIP-${aip.metadata.titulo.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}-${Date.now()}.zip`;

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": zipBuffer.length,
    });

    // Log da exportação
    aip.processingLogs.push({
      level: "info",
      message: `DIP exportado por ${req.user.username}`,
    });
    await aip.save();

    res.send(zipBuffer);
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
