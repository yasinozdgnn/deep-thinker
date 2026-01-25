export const databaseTools = [
  {
    name: "analyze_query",
    description: "Analyze SQL query performance and suggest optimizations.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL query to analyze" },
        dbType: { type: "string", description: "Database type: mysql, postgres, mssql, sqlite, oracle" },
      },
      required: ["query", "dbType"],
    },
  },
  {
    name: "explain_schema",
    description: "Document database schema with ER diagrams.",
    inputSchema: {
      type: "object",
      properties: {
        schemaFile: { type: "string", description: "Path to schema file" },
        outputFormat: { type: "string", description: "Output format: markdown, json, plantuml" },
      },
      required: ["schemaFile"],
    },
  },
  {
    name: "suggest_indexes",
    description: "Suggest optimal indexes for database performance.",
    inputSchema: {
      type: "object",
      properties: {
        schemaFile: { type: "string", description: "Path to schema file" },
        queryPatterns: { type: "string", description: "Common query patterns" },
        dbType: { type: "string", description: "Database type" },
      },
      required: ["schemaFile", "dbType"],
    },
  },
  {
    name: "review_migration",
    description: "Review migration files for safety and best practices.",
    inputSchema: {
      type: "object",
      properties: {
        migrationFile: { type: "string", description: "Path to migration file" },
        dbType: { type: "string", description: "Database type" },
        context: { type: "string", description: "Previous migration context" },
      },
      required: ["migrationFile", "dbType"],
    },
  },
];
