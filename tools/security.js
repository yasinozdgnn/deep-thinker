export const securityTools = [
  {
    name: "security_scan",
    description: "OWASP Top 10 security scan for code.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to scan" },
        scanType: { type: "string", description: "Scan type: full, quick, custom" },
        rules: { type: "string", description: "OWASP rules subset" },
      },
      required: ["filePath", "scanType"],
    },
  },
  {
    name: "dependency_audit",
    description: "Audit dependencies for security vulnerabilities.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        packageManager: { type: "string", description: "Package manager: npm, yarn, pnpm, pip, go, cargo" },
      },
      required: ["projectPath", "packageManager"],
    },
  },
  {
    name: "secrets_scanner",
    description: "Scan for hardcoded secrets and credentials.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "Directory to scan" },
        secretTypes: { type: "string", description: "Secret types: api_key, password, token, certificate, private_key, all" },
      },
      required: ["dirPath", "secretTypes"],
    },
  },
  {
    name: "api_security",
    description: "Analyze API endpoint security.",
    inputSchema: {
      type: "object",
      properties: {
        apiSpec: { type: "string", description: "OpenAPI spec or code paths" },
        securityHeaders: { type: "boolean", description: "Check security headers" },
        authType: { type: "string", description: "Auth type: jwt, oauth, apikey, basic" },
      },
      required: ["apiSpec"],
    },
  },
  {
    name: "bundle_analysis",
    description: "Analyze bundle size and optimization opportunities.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        framework: { type: "string", description: "Framework: react, vue, next, angular, vanilla" },
        target: { type: "string", description: "Target: browser, node, mobile" },
      },
      required: ["projectPath", "framework", "target"],
    },
  },
  {
    name: "memory_leak_detect",
    description: "Detect potential memory leaks in code.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to analyze" },
        language: { type: "string", description: "Language: javascript, typescript, python, go" },
      },
      required: ["filePath", "language"],
    },
  },
  {
    name: "api_response_time",
    description: "Benchmark API response times.",
    inputSchema: {
      type: "object",
      properties: {
        apiEndpoint: { type: "string", description: "API URL" },
        method: { type: "string", description: "HTTP method: GET, POST, PUT, DELETE" },
        iterations: { type: "number", description: "Number of test iterations" },
      },
      required: ["apiEndpoint", "method"],
    },
  },
  {
    name: "caching_strategy",
    description: "Suggest caching strategies for performance.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        cacheType: { type: "string", description: "Cache type: redis, memcached, in-memory, cdn, all" },
        useCase: { type: "string", description: "Use case: api, database, static, session" },
      },
      required: ["projectPath", "cacheType", "useCase"],
    },
  },
];
