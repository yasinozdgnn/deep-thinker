export const apiTools = [
  {
    name: "openapi_spec",
    description: "Generate OpenAPI/Swagger specification from code.",
    inputSchema: {
      type: "object",
      properties: {
        codePath: { type: "string", description: "API code directory" },
        outputFormat: { type: "string", description: "Output format: yaml, json" },
        version: { type: "string", description: "OpenAPI version: 3.0, 3.1" },
      },
      required: ["codePath", "outputFormat"],
    },
  },
  {
    name: "api_client_generator",
    description: "Generate type-safe API client code.",
    inputSchema: {
      type: "object",
      properties: {
        openapiSpec: { type: "string", description: "OpenAPI spec path" },
        targetLanguage: { type: "string", description: "Target language: typescript, python, go, rust, java" },
        clientType: { type: "string", description: "Client type: axios, fetch, openai, custom" },
      },
      required: ["openapiSpec", "targetLanguage", "clientType"],
    },
  },
  {
    name: "graphql_schema",
    description: "Design GraphQL schema from database.",
    inputSchema: {
      type: "object",
      properties: {
        databaseSchema: { type: "string", description: "Database schema path" },
        useCase: { type: "string", description: "Use case: rest_to_graphql, new_api, federation" },
      },
      required: ["databaseSchema", "useCase"],
    },
  },
  {
    name: "api_migration",
    description: "Plan migration from REST to GraphQL.",
    inputSchema: {
      type: "object",
      properties: {
        openapiSpec: { type: "string", description: "Existing OpenAPI spec" },
        migrationStrategy: { type: "string", description: "Strategy: incremental, big_bang" },
      },
      required: ["openapiSpec", "migrationStrategy"],
    },
  },
];
