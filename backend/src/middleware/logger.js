const Log = require("../models/logSchema");

// Middleware de logging
const logAction = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function (data) {
      logRequest.call(this, data);
      originalSend.call(this, data);
    };

    res.json = function (data) {
      logRequest.call(this, data);
      originalJson.call(this, data);
    };

    const logRequest = async function (responseData) {
      try {
        // Só log para requests bem-sucedidos (ou conforme necessário)
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const logData = {
            action,
            user: req.user?._id,
            resource: req.params.id || req.params.aipId,
            resourceType: determineResourceType(req.originalUrl),
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get("User-Agent"),
            sessionId: req.sessionID,
            details: {
              method: req.method,
              url: req.originalUrl,
              statusCode: res.statusCode,
              query: req.query,
              body: sanitizeBody(req.body),
            },
            success: res.statusCode >= 200 && res.statusCode < 400,
          };

          await Log.create(logData);
        }
      } catch (error) {
        console.error("Logging error:", error);
      }
    };

    next();
  };
};

// Determinar tipo de recurso baseado na URL
const determineResourceType = (url) => {
  if (url.includes("/sip/")) return "sip";
  if (url.includes("/aips/")) return "aip";
  if (url.includes("/dip/")) return "dip";
  if (url.includes("/auth/")) return "user";
  if (url.includes("/news/")) return "news";
  if (url.includes("/comments/")) return "comment";
  return "unknown";
};

// Sanitizar dados sensíveis do body
const sanitizeBody = (body) => {
  if (!body) return {};

  const sanitized = { ...body };

  // Remover campos sensíveis
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;

  return sanitized;
};

// Log de erro
const logError = async (error, req, action = "error") => {
  try {
    await Log.create({
      action,
      user: req.user?._id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      details: {
        method: req.method,
        url: req.originalUrl,
        error: error.message,
        stack: error.stack,
      },
      success: false,
      errorMessage: error.message,
    });
  } catch (logError) {
    console.error("Error logging error:", logError);
  }
};

module.exports = { logAction, logError };
