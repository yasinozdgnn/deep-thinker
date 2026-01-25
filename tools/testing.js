export const testingTools = [
  {
    name: "generate_tests",
    description: "Generate unit tests for code file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to generate tests for" },
        framework: { type: "string", description: "Test framework (jest, mocha, vitest, pytest)" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "generate_docs",
    description: "Generate JSDoc/TSDoc documentation for file.",
    inputSchema: {
      type: "object",
      properties: { filePath: { type: "string", description: "File to document" } },
      required: ["filePath"],
    },
  },
  {
    name: "create_readme",
    description: "Generate README.md for a project.",
    inputSchema: {
      type: "object",
      properties: { projectPath: { type: "string", description: "Project root directory" } },
      required: ["projectPath"],
    },
  },
  {
    name: "generate_e2e_tests",
    description: "Generate E2E tests using Playwright or Cypress.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to generate E2E tests for" },
        framework: { type: "string", description: "Framework: playwright, cypress" },
        testType: { type: "string", description: "Test type: happy_path, error_handling, edge_cases, all" },
      },
      required: ["filePath", "framework", "testType"],
    },
  },
  {
    name: "test_coverage_analysis",
    description: "Analyze test coverage and identify gaps.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        testFramework: { type: "string", description: "Test framework" },
        targetCoverage: { type: "number", description: "Target coverage percentage (default: 80)" },
      },
      required: ["projectPath", "testFramework"],
    },
  },
  {
    name: "mock_generator",
    description: "Generate API mocks for testing.",
    inputSchema: {
      type: "object",
      properties: {
        apiSpec: { type: "string", description: "OpenAPI spec path or inline spec" },
        outputFormat: { type: "string", description: "Format: msw, nock, mock-service-worker, json" },
      },
      required: ["apiSpec", "outputFormat"],
    },
  },
  {
    name: "load_test_script",
    description: "Generate load testing scripts.",
    inputSchema: {
      type: "object",
      properties: {
        apiSpec: { type: "string", description: "API endpoint list or OpenAPI spec" },
        framework: { type: "string", description: "Framework: k6, artillery, locust" },
        testProfile: { type: "string", description: "Profile: smoke, load, stress, spike, endurance" },
      },
      required: ["apiSpec", "framework", "testProfile"],
    },
  },
];
