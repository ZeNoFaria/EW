const SIP = require("../models/sipSchema");
const fs = require("fs"); // IMPORTAR fs normal
const fsPromises = require("fs").promises; // E promises separadamente
const path = require("path");
const AdmZip = require("adm-zip");

// Export AIP as DIP
exports.exportDIP = async (req, res) => {
  try {
    const aipId = req.params.id;

    console.log(`=== EXPORT DIP INICIADO ===`);
    console.log(`AIP ID: ${aipId}`);
    console.log(`User: ${req.user._id}`);

    // Buscar AIP
    const aip = await SIP.findById(aipId)
      .populate("metadata.produtor", "username")
      .populate("metadata.tipo", "name")
      .populate("metadata.tags", "name");

    if (!aip) {
      console.log("AIP não encontrado");
      return res.status(404).json({ error: "AIP não encontrado" });
    }

    // Verificar permissões
    const isOwner =
      aip.metadata.produtor._id.toString() === req.user._id.toString();
    const isPublic = aip.isPublic;
    const isAdmin = req.user.isAdmin;

    if (!isOwner && !isPublic && !isAdmin) {
      console.log("Sem permissão para acessar AIP");
      return res
        .status(403)
        .json({ error: "Sem permissão para acessar este AIP" });
    }

    console.log(
      `Permissões OK - Owner: ${isOwner}, Public: ${isPublic}, Admin: ${isAdmin}`
    );

    // Verificar se existem arquivos
    if (!aip.files || aip.files.length === 0) {
      console.log("AIP sem arquivos");
      return res
        .status(400)
        .json({ error: "AIP não possui arquivos para exportar" });
    }

    console.log(`Arquivos encontrados: ${aip.files.length}`);

    // Criar ZIP para DIP
    const zip = new AdmZip();

    // Adicionar manifesto DIP
    const dipManifesto = {
      type: "DIP",
      version: "1.0",
      created: new Date().toISOString(),
      source_aip: aipId,
      metadata: {
        titulo: aip.metadata.titulo,
        descricao: aip.metadata.descricao,
        tipo: aip.metadata.tipo ? aip.metadata.tipo.name : null,
        tags: aip.metadata.tags ? aip.metadata.tags.map((tag) => tag.name) : [],
        produtor: aip.metadata.produtor.username,
        dataCreacao: aip.metadata.dataCreacao,
        isPublic: aip.isPublic,
      },
      files: [],
    };

    // Adicionar arquivos ao ZIP
    let filesAdded = 0;

    for (const file of aip.files) {
      try {
        const filePath = file.path;
        console.log(`Verificando arquivo: ${filePath}`);

        // USAR fs.existsSync corretamente
        if (fs.existsSync(filePath)) {
          console.log(`Adicionando arquivo: ${file.originalName}`);

          // Ler arquivo e adicionar ao ZIP
          const fileBuffer = await fsPromises.readFile(filePath);
          zip.addFile(file.originalName, fileBuffer);

          // Adicionar info ao manifesto
          dipManifesto.files.push({
            originalName: file.originalName,
            size: file.size,
            mimetype: file.mimetype,
            checksum: file.checksum,
          });

          filesAdded++;
        } else {
          console.warn(`Arquivo não encontrado: ${filePath}`);
        }
      } catch (fileError) {
        console.error(
          `Erro ao processar arquivo ${file.originalName}:`,
          fileError
        );
      }
    }

    if (filesAdded === 0) {
      console.log("Nenhum arquivo foi adicionado ao DIP");
      return res
        .status(500)
        .json({ error: "Não foi possível acessar os arquivos do AIP" });
    }

    // Adicionar manifesto ao ZIP
    zip.addFile(
      "manifesto-DIP.json",
      Buffer.from(JSON.stringify(dipManifesto, null, 2))
    );

    console.log(`DIP criado com ${filesAdded} arquivos`);

    // Configurar headers para download
    const filename = `DIP-${
      aip.metadata.titulo?.replace(/[^a-zA-Z0-9]/g, "_") || aipId
    }.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Enviar ZIP
    const zipBuffer = zip.toBuffer();
    res.setHeader("Content-Length", zipBuffer.length);

    console.log(`Enviando DIP: ${filename} (${zipBuffer.length} bytes)`);
    res.send(zipBuffer);
  } catch (error) {
    console.error("Erro ao exportar DIP:", error);
    res.status(500).json({
      error: "Erro ao exportar DIP",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Serve individual file from AIP
exports.serveFile = async (req, res) => {
  try {
    const { id: aipId, fileId } = req.params;

    console.log(`=== SERVE FILE INICIADO ===`);
    console.log(`AIP ID: ${aipId}, File ID: ${fileId}`);

    // Buscar AIP
    const aip = await SIP.findById(aipId);

    if (!aip) {
      return res.status(404).json({ error: "AIP não encontrado" });
    }

    // Verificar permissões
    const isOwner =
      aip.metadata.produtor.toString() === req.user._id.toString();
    const isPublic = aip.isPublic;
    const isAdmin = req.user.isAdmin;

    if (!isOwner && !isPublic && !isAdmin) {
      return res
        .status(403)
        .json({ error: "Sem permissão para acessar este arquivo" });
    }

    // Encontrar arquivo
    const file = aip.files.find((f) => f._id.toString() === fileId);

    if (!file) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }

    // Verificar se arquivo existe no sistema de arquivos
    if (!fs.existsSync(file.path)) {
      console.error(`Arquivo não encontrado no disco: ${file.path}`);
      return res.status(404).json({ error: "Arquivo não disponível" });
    }

    // Configurar headers
    res.setHeader("Content-Type", file.mimetype || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.originalName}"`
    );

    // Adicionar Content-Length se disponível
    if (file.size) {
      res.setHeader("Content-Length", file.size);
    }

    // Criar stream e enviar arquivo
    const fileStream = fs.createReadStream(file.path);

    fileStream.on("error", (streamError) => {
      console.error("Erro no stream do arquivo:", streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erro ao ler arquivo" });
      }
    });

    fileStream.pipe(res);

    console.log(`Arquivo servido: ${file.originalName}`);
  } catch (error) {
    console.error("Erro ao servir arquivo:", error);
    res.status(500).json({
      error: "Erro ao servir arquivo",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
