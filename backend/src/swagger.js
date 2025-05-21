const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Digital Diary API",
      version: "1.0.0",
      description: "API for the Digital Diary application",
    },
    servers: [
      {
        url: "/api",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.js"], // Path to the API routes files
};

module.exports = swaggerJsdoc(options);
