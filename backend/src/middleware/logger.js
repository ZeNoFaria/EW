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
            resource: req.params.id || req.params.aipId || req.params.entryId,
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
        console.error("Logging error:", error.message);
        // Don't throw error to avoid breaking the request
      }
    };

    next();
  };
};

// Determinar tipo de recurso baseado na URL - Melhorado
const determineResourceType = (url) => {
  // API endpoints
  if (url.includes("/api/entries") || url.includes("/entries")) return "entry";
  if (url.includes("/api/categories") || url.includes("/categories"))
    return "category";
  if (url.includes("/api/users") || url.includes("/users")) return "user";
  if (url.includes("/api/auth") || url.includes("/auth")) return "auth";
  if (url.includes("/api/admin") || url.includes("/admin")) return "admin";
  if (url.includes("/api/news") || url.includes("/news")) return "news";
  if (url.includes("/api/comments") || url.includes("/comments"))
    return "comment";
  if (url.includes("/api/tags") || url.includes("/tags")) return "tag";

  // SIP system endpoints (legacy)
  if (url.includes("/sip/")) return "sip";
  if (url.includes("/aips/")) return "aip";
  if (url.includes("/dip/")) return "dip";

  // Frontend pages
  if (url === "/" || url.startsWith("/timeline") || url.startsWith("/entry"))
    return "page";

  // API calls
  if (url.startsWith("/api/")) return "api";

  // Default to other instead of unknown
  return "other";
};

// Sanitizar dados sensíveis do body
const sanitizeBody = (body) => {
  if (!body) return {};

  const sanitized = { ...body };

  // Remover campos sensíveis
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;
  delete sanitized.passwordConfirm;

  return sanitized;
};

// Log de erro
const logError = async (error, req, action = "error") => {
  try {
    await Log.create({
      action,
      user: req.user?._id,
      resourceType: determineResourceType(req.originalUrl),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      sessionId: req.sessionID,
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
    console.error("Error logging error:", logError.message);
  }
};

// Log simples para eventos específicos
const logSimpleAction = async (
  userId,
  action,
  resourceType = "other",
  resourceId = null,
  details = {}
) => {
  try {
    await Log.create({
      action,
      user: userId,
      resource: resourceId,
      resourceType,
      details,
      success: true,
    });
  } catch (error) {
    console.error("Simple logging error:", error.message);
  }
};

// Log de autenticação
const logAuthAction = async (userId, action, details = {}, success = true) => {
  try {
    await Log.create({
      action,
      user: userId,
      resourceType: "auth",
      details,
      success,
      errorMessage: success ? null : details.error,
    });
  } catch (error) {
    console.error("Auth logging error:", error.message);
  }
};

module.exports = {
  logAction,
  logError,
  logSimpleAction,
  logAuthAction,
  determineResourceType,
};
