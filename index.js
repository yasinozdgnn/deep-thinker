import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

// === GLOBAL ERROR HANDLERS ===
process.on('uncaughtException', (error) => {
  console.error('🚨 KRİTİK HATA (Sunucu çalışmaya devam ediyor):', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Yakalanmayan Promise Hatası:', reason);
});
// =============================

import { MemoryManager } from "./memory/index.js";
import { TaskPlanner } from "./planner/index.js";
import { ToolOrchestrator, getWorkflow, listWorkflows, WORKFLOWS, RetryManager, ValidationEngine } from "./orchestrator/index.js";
import { SelfImprovement, StrategyOptimizer, PatternLearner } from "./learning/index.js";
import { TaskDecomposer } from "./decomposer/index.js";
import { AgentCoordinator, MiniAgent, AgentPool } from "./agents/index.js";
import { generateProjectId } from "./config.js";
import { callGLM, callGLMWithThinking, extractCodeFromResponse } from "./helpers/index.js";
import { readFileContent, writeFileContent, searchFiles, scanProjectStructure, readImportantProjectFiles, collectDirectoryFiles } from "./helpers/index.js";
import { runGitCommand, getGitDiff } from "./helpers/index.js";
import { buildToolDetectionPrompt } from "./prompts/index.js";

const server = new Server(
  {
    name: "glm-deepthinker",
    version: "4.1.0",
  },
  {
    capabilities: { tools: {} },
  },
);

import { handlers } from './handlers/index.js';

// Tool definitions imported from modular structure
import { tools } from './tools/index.js';

let activeMemory = null;
let activePlanner = null;
let activeOrchestrator = null;
let activeLearning = null;
let activeDecomposer = null;
let activeCoordinator = null;
let activeStrategyOptimizer = null;
let activePatternLearner = null;
let activeRetryManager = null;
let activeValidationEngine = null;

function getAgentModules(projectPath) {
  if (!activeMemory || activeMemory.projectPath !== projectPath) {
    activeMemory = new MemoryManager(projectPath);
    activePlanner = new TaskPlanner(projectPath);
    activeOrchestrator = new ToolOrchestrator(projectPath);
    activeLearning = new SelfImprovement(projectPath);
    activeDecomposer = new TaskDecomposer(projectPath);
    activeCoordinator = new AgentCoordinator(projectPath);
    activeStrategyOptimizer = new StrategyOptimizer(activeMemory);
    activePatternLearner = new PatternLearner(activeMemory);
    activeRetryManager = new RetryManager();
    activeValidationEngine = new ValidationEngine();
  }
  return { 
    memory: activeMemory, 
    planner: activePlanner, 
    orchestrator: activeOrchestrator, 
    learning: activeLearning,
    decomposer: activeDecomposer,
    coordinator: activeCoordinator,
    strategyOptimizer: activeStrategyOptimizer,
    patternLearner: activePatternLearner,
    retryManager: activeRetryManager,
    validationEngine: activeValidationEngine
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

// AI-powered tool detection using modular prompt
async function autoDetectTool(prompt) {
  const toolPrompt = buildToolDetectionPrompt(prompt);
  const response = await callGLM(toolPrompt);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (result.tool && typeof result.confidence === "number") {
        return result;
      }
    }
  } catch (error) {
    console.error("Failed to parse auto-detect response:", error.message);
  }

  return {
    tool: null,
    confidence: 0,
    reasoning: "Could not determine appropriate tool",
  };
}

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Check modular handlers first
  if (handlers[name]) {
    try {
      return await handlers[name](args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error executing ${name}: ${error.message}` }],
        isError: true
      };
    }
  }

  try {
    switch (name) {
      // === AUTO-DETECT (AI-powered tool selection) ===
      // Tools moved to handlers/core.js


      // === CORE TOOLS ===






      // === FILE OPERATIONS ===
      // Tools moved to handlers/file-ops.js














      // Tools moved to handlers/code-analysis.js










      // === GIT OPERATIONS ===
      // Tools moved to handlers/git-ops.js




      // === TEST & DOCS ===
      case "generate_tests": {
        const code = await readFileContent(args.filePath);
        const framework = args.framework || "jest";
        const prompt = `Generate comprehensive unit tests for this code using ${framework}:\n\`\`\`\n${code}\n\`\`\``;
        const result = await callGLM(prompt);
        const testPath = args.filePath.replace(/(\.\w+)$/, `.test$1`);
        const testCode = extractCodeFromResponse(result);
        await writeFileContent(testPath, testCode);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking]\n\nTests saved: ${testPath}\n\n${result}`,
            },
          ],
        };
      }

      case "generate_docs": {
        const code = await readFileContent(args.filePath);
        const prompt = `Add JSDoc/TSDoc documentation to all functions and classes in this code:\n\`\`\`\n${code}\n\`\`\`\n\nReturn only the documented code.`;
        const result = await callGLM(prompt);
        const newCode = extractCodeFromResponse(result);
        await writeFileContent(args.filePath, newCode);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking]\n\nDocs added: ${args.filePath}`,
            },
          ],
        };
      }

      case "create_readme": {
        const files = await fs.readdir(args.projectPath, {
          withFileTypes: true,
        });
        const fileList = files.map((f) => f.name).join(", ");
        let packageInfo = "";
        try {
          const pkg = await readFileContent(
            path.join(args.projectPath, "package.json"),
          );
          packageInfo = `\n\npackage.json:\n${pkg}`;
        } catch { }
        const prompt = `Create a comprehensive README.md for this project.\n\nFiles: ${fileList}${packageInfo}`;
        const result = await callGLM(prompt);
        const readme = extractCodeFromResponse(result) || result;
        await writeFileContent(
          path.join(args.projectPath, "README.md"),
          readme,
        );
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking]\n\nREADME created!\n\n${result}`,
            },
          ],
        };
      }

      // === PROJECT MANAGEMENT ===
      case "create_project": {
        const prompt = `Create a ${args.projectType} project boilerplate structure for "${args.projectName}". Include all necessary files with their contents. Format as JSON: { "files": [{ "path": "relative/path", "content": "file content" }] }`;
        const result = await callGLM(prompt);

        try {
          const jsonMatch = result.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const structure = JSON.parse(jsonMatch[0]);
            for (const file of structure.files) {
              const fullPath = path.join(args.projectPath, file.path);
              await writeFileContent(fullPath, file.content);
            }
            return {
              content: [
                {
                  type: "text",
                  text: `[Deep Thinking]\n\nProject created at: ${args.projectPath}\n\nFiles: ${structure.files.map((f) => f.path).join(", ")}`,
                },
              ],
            };
          }
        } catch { }
        return {
          content: [{ type: "text", text: `[Deep Thinking]\n\n${result}` }],
        };
      }

      case "add_dependency": {
        const cmd = args.isDev ? "npm install --save-dev" : "npm install";
        await execAsync(`${cmd} ${args.packageName}`, {
          cwd: args.projectPath,
        });
        const prompt = `Explain what the npm package "${args.packageName}" does and provide a basic usage example.`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking]\n\nInstalled: ${args.packageName}\n\n${result}`,
            },
          ],
        };
      }

      // === DATABASE TOOLS ===
      case "analyze_query": {
        const prompt = `Analyze this ${args.dbType} SQL query for performance and suggest optimizations:\n\`\`\`sql\n${args.query}\n\`\`\`\n\nProvide:\n1. Query execution plan analysis\n2. N+1 query detection\n3. Index recommendations\n4. Performance bottlenecks\n5. Optimized query version`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Query Analysis]\n\n${result}`,
            },
          ],
        };
      }

      case "explain_schema": {
        let schemaContent = "";
        try {
          schemaContent = await readFileContent(args.schemaFile);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error reading schema file: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
        const outputFormat = args.outputFormat || "markdown";
        const prompt = `Document this database schema in ${outputFormat} format. Include:\n1. All tables and columns\n2. Foreign key relationships\n3. Index list\n4. ER diagram (use PlantUML)\n5. Schema explanations\n\nSchema:\n\`\`\`\n${schemaContent}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Schema Documentation]\n\n${result}`,
            },
          ],
        };
      }

      case "suggest_indexes": {
        let schemaContent = "";
        try {
          schemaContent = await readFileContent(args.schemaFile);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error reading schema file: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
        const prompt = `Suggest optimal indexes for this ${args.dbType} database schema. ${args.queryPatterns ? `Query patterns: ${args.queryPatterns}` : ""}\n\nProvide:\n1. Which columns to index\n2. Composite index recommendations\n3. Index size estimation\n4. Write vs read tradeoff analysis\n5. SQL CREATE INDEX statements\n\nSchema:\n\`\`\`\n${schemaContent}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Index Recommendations]\n\n${result}`,
            },
          ],
        };
      }

      case "review_migration": {
        let migrationContent = "";
        try {
          migrationContent = await readFileContent(args.migrationFile);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error reading migration file: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
        const prompt = `Review this ${args.dbType} migration file for safety and best practices. ${args.context ? `Context: ${args.context}` : ""}\n\nProvide:\n1. Potential data loss risks\n2. Rollback safety assessment\n3. Downwards compatibility check\n4. Performance impact\n5. Best practice violations\n\nMigration:\n\`\`\`\n${migrationContent}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Migration Review]\n\n${result}`,
            },
          ],
        };
      }

      // === GIT ADVANCED TOOLS ===
      // Advanced Git tools moved to handlers/git-ops.js


      // === CI/CD & DEVOPS TOOLS ===
      case "generate_dockerfile": {
        const prompt = `Generate an optimized Dockerfile for a ${args.framework} project. Target: ${args.target}, Optimization: ${args.optimization || "multi-stage"}\n\nProvide:\n1. Optimized Dockerfile with multi-stage build\n2. .dockerignore file\n3. docker-compose.yml if needed\n4. Build and run commands\n5. Security considerations`;
        const result = await callGLM(prompt);
        const dockerfile = extractCodeFromResponse(result);
        const dockerfilePath = path.join(args.projectPath, "Dockerfile");
        await writeFileContent(dockerfilePath, dockerfile);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Docker Configuration]\n\n${result}`,
            },
          ],
        };
      }

      case "generate_github_actions": {
        const prompt = `Generate GitHub Actions CI/CD workflow for a ${args.language} project. Workflow type: ${args.workflowType}\n\nProvide:\n1. Complete GitHub Actions workflow YAML\n2. Multi-environment support\n3. Cache strategies\n4. Secret management examples\n5. Best practices`;
        const result = await callGLM(prompt);
        const workflow = extractCodeFromResponse(result);
        const workflowPath = path.join(
          args.projectPath,
          ".github",
          "workflows",
          `${args.workflowType}.yml`,
        );
        await writeFileContent(workflowPath, workflow);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - GitHub Actions Workflow]\n\n${result}`,
            },
          ],
        };
      }

      case "k8s_manifest": {
        const resources = args.resources || "Deployment,Service,Ingress";
        const prompt = `Generate Kubernetes manifests for deployment. Type: ${args.deploymentType}, Resources: ${resources}\n\nProvide:\n1. deployment.yaml\n2. service.yaml\n3. ingress.yaml\n4. configmap.yaml (if needed)\n5. hpa.yaml for horizontal pod autoscaling\n\nFollow Kubernetes best practices with health checks, rolling updates, and resource limits.`;
        const result = await callGLM(prompt);
        const k8sDir = path.join(args.projectPath, "k8s");
        await fs.mkdir(k8sDir, { recursive: true });
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Kubernetes Manifests]\n\n${result}`,
            },
          ],
        };
      }

      case "terraform_module": {
        const prompt = `Generate Terraform modules for ${args.infrastructureType} ${args.serviceType} infrastructure.\n\nProvide:\n1. Complete Terraform HCL code\n2. variables.tf\n3. outputs.tf\n4. main.tf\n5. README for the terraform module\n\nFollow Terraform best practices, infrastructure as code patterns, and include state management and module versioning.`;
        const result = await callGLM(prompt);
        const terraformCode = extractCodeFromResponse(result);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Terraform Module]\n\n${result}`,
            },
          ],
        };
      }

      // === TEST ADVANCED TOOLS ===
      case "generate_e2e_tests": {
        const code = await readFileContent(args.filePath);
        const prompt = `Generate comprehensive E2E tests using ${args.framework} for this code. Test type: ${args.testType}\n\nProvide:\n1. Complete E2E test file\n2. Page objects (if applicable)\n3. Test fixtures\n4. Configuration file\n5. Setup instructions\n\nUse Page Object Pattern, test data management, parallel test execution, and cross-browser testing setup.\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
        const result = await callGLM(prompt);
        const testCode = extractCodeFromResponse(result);
        const testPath = args.filePath.replace(/(\.\w+)$/, `.e2e$1`);
        await writeFileContent(testPath, testCode);
        return {
          content: [
            { type: "text", text: `[Deep Thinking - E2E Tests]\n\n${result}` },
          ],
        };
      }

      case "test_coverage_analysis": {
        const targetCoverage = args.targetCoverage || 80;
        const prompt = `Analyze test coverage for this project and identify gaps. Framework: ${args.framework}, Target coverage: ${targetCoverage}%\n\nProvide:\n1. Coverage report analysis\n2. Missing test areas\n3. Critical path coverage\n4. Coverage improvement plan\n5. Prioritization recommendations`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Test Coverage Analysis]\n\n${result}`,
            },
          ],
        };
      }

      case "mock_generator": {
        let specContent = args.apiSpec;
        if (
          args.apiSpec &&
          !args.apiSpec.startsWith("http") &&
          !args.apiSpec.includes("{")
        ) {
          try {
            specContent = await readFileContent(args.apiSpec);
          } catch { }
        }
        const prompt = `Generate API mocks for testing based on this OpenAPI spec. Output format: ${args.outputFormat}\n\nProvide:\n1. Mock handler files\n2. Mock data generators\n3. Response templates\n4. Error scenario mocks\n\nOpenAPI Spec:\n\`\`\`\n${specContent}\n\`\`\``;
        const result = await callGLM(prompt);
        const mockCode = extractCodeFromResponse(result);
        return {
          content: [
            { type: "text", text: `[Deep Thinking - API Mocks]\n\n${result}` },
          ],
        };
      }

      case "load_test_script": {
        let specContent = args.apiSpec;
        if (args.apiSpec && !args.apiSpec.includes("{")) {
          try {
            specContent = await readFileContent(args.apiSpec);
          } catch { }
        }
        const prompt = `Generate load testing scripts using ${args.framework}. Test profile: ${args.testProfile}\n\nProvide:\n1. Complete load test script\n2. Test scenarios\n3. Threshold configurations\n4. Result analysis guide\n5. Performance baseline recommendations\n\nAPI Spec:\n\`\`\`\n${specContent}\n\`\`\``;
        const result = await callGLM(prompt);
        const testScript = extractCodeFromResponse(result);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Load Testing]\n\n${result}`,
            },
          ],
        };
      }

      // === SECURITY & SAST TOOLS ===
      case "security_scan": {
        const code = await readFileContent(args.filePath);
        const scanType = args.scanType || "full";
        const prompt = `Perform OWASP Top 10 security scan on this code. Then FIX all security issues and return the secure code.

IMPORTANT: Return your response in this format:
1. First, list all security vulnerabilities with severity levels (Critical, High, Medium, Low)
2. Then provide the COMPLETE secured code in a code block

Check for: SQL injection, XSS, CSRF, Input validation, Auth issues, Security misconfigurations

Code:
\`\`\`
${code}
\`\`\``;
        const result = await callGLM(prompt);
        const securedCode = extractCodeFromResponse(result);
        if (securedCode && securedCode.trim() !== code.trim()) {
          await writeFileContent(args.filePath, securedCode);
        }
        return {
          content: [{
            type: "text",
            text: `[Deep Thinking - Security Scan & Fix]\n\n${result}\n\n✅ File updated: ${args.filePath}`
          }]
        };
      }

      case "dependency_audit": {
        let lockFile = "";
        const lockFilePaths = {
          npm: "package-lock.json",
          yarn: "yarn.lock",
          pnpm: "pnpm-lock.yaml",
          pip: "requirements.txt",
          go: "go.sum",
          cargo: "Cargo.lock",
        };
        try {
          lockFile = await readFileContent(
            path.join(args.projectPath, lockFilePaths[args.packageManager]),
          );
        } catch { }
        const prompt = `Audit ${args.packageManager} dependencies for security vulnerabilities.\n\nProvide:\n1. Vulnerable dependencies list\n2. CVE details and severity\n3. Fixed version alternatives\n4. Update recommendations\n5. Risk assessment\n\nLock file content:\n${lockFile || "No lock file found"}`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Dependency Audit]\n\n${result}`,
            },
          ],
        };
      }

      case "secrets_scanner": {
        const results = [];
        const secretPatterns = {
          api_key: /(?:api[_-]?key|apikey)["'\s:=]+[a-zA-Z0-9_-]{20,}/gi,
          password: /(?:password|passwd|pwd)["'\s:=]+[^\s'"`]{8,}/gi,
          token: /(?:token|bearer|auth)["'\s:=]+[a-zA-Z0-9_-]{20,}/gi,
          certificate:
            /-----BEGIN\sCERTIFICATE-----[\s\S]*?-----END\sCERTIFICATE-----/gi,
          private_key:
            /-----BEGIN\s(?:RSA\s)?PRIVATE\sKEY-----[\s\S]*?-----END\s(?:RSA\s)?PRIVATE\sKEY-----/gi,
        };
        const patterns =
          args.secretTypes === "all"
            ? Object.keys(secretPatterns)
            : args.secretTypes.split(",");

        async function walk(dir) {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (
              entry.isDirectory() &&
              !entry.name.startsWith(".") &&
              entry.name !== "node_modules"
            ) {
              await walk(fullPath);
            } else if (entry.isFile()) {
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                patterns.forEach((pattern) => {
                  if (secretPatterns[pattern]) {
                    const matches = content.match(secretPatterns[pattern]);
                    if (matches) {
                      results.push({
                        file: fullPath,
                        pattern,
                        count: matches.length,
                      });
                    }
                  }
                });
              } catch { }
            }
          }
        }
        await walk(args.dirPath);

        const prompt = `Analyze these secret detection results and provide recommendations:\n${JSON.stringify(results, null, 2)}\n\nProvide:\n1. Found secrets locations\n2. Secret type classification\n3. Risk assessment\n4. Remediation recommendations\n5. Prevention strategies`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Secrets Scanner]\n\n${result}`,
            },
          ],
        };
      }

      case "api_security": {
        let specContent = args.apiSpec;
        if (args.apiSpec && !args.apiSpec.includes("{")) {
          try {
            specContent = await readFileContent(args.apiSpec);
          } catch { }
        }
        const prompt = `Analyze API endpoint security. Auth type: ${args.authType || "jwt"}, Check headers: ${args.securityHeaders}\n\nProvide:\n1. Security gaps\n2. Authentication issues\n3. Authorization problems\n4. Rate limiting recommendations\n5. Security header analysis\n\nCheck for:\n- Authentication/authorization implementation\n- Input validation\n- Rate limiting\n- CORS configuration\n- Security headers\n\nAPI Spec:\n\`\`\`\n${specContent}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - API Security]\n\n${result}`,
            },
          ],
        };
      }

      // === PERFORMANCE & OPTIMIZATION TOOLS ===
      case "bundle_analysis": {
        const prompt = `Analyze bundle size and optimization opportunities for ${args.framework} project. Target: ${args.target}\n\nProvide:\n1. Bundle composition analysis\n2. Large dependencies identified\n3. Tree-shaking opportunities\n4. Code splitting suggestions\n5. Lazy load recommendations\n6. Import optimization tips`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Bundle Analysis]\n\n${result}`,
            },
          ],
        };
      }

      case "memory_leak_detect": {
        const code = await readFileContent(args.filePath);
        const prompt = `Detect potential memory leaks in this ${args.language} code.\n\nProvide:\n1. Potential memory leak patterns\n2. Event listener cleanup issues\n3. Closure retention problems\n4. Caching concerns\n5. Remediation code examples\n\nCheck for:\n- Unclosed event listeners\n- Unreleased references\n- Closure memory retention\n- Cache without eviction\n- Interval/setTimeout not cleared\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Memory Leak Detection]\n\n${result}`,
            },
          ],
        };
      }

      case "api_response_time": {
        const iterations = args.iterations || 100;
        const prompt = `Benchmark API response times. Method: ${args.method}, Endpoint: ${args.apiEndpoint}, Iterations: ${iterations}\n\nProvide:\n1. Response time statistics\n2. P50, P90, P99 latencies\n3. Throughput analysis\n4. Bottleneck identification\n5. Optimization recommendations`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - API Performance Benchmark]\n\n${result}`,
            },
          ],
        };
      }

      case "caching_strategy": {
        const prompt = `Suggest caching strategies for ${args.cacheType}. Use case: ${args.useCase}\n\nProvide:\n1. Cache layer recommendations\n2. TTL strategies\n3. Cache invalidation patterns\n4. Multi-layer caching design\n5. Consistency considerations\n6. Performance impact analysis`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Caching Strategy]\n\n${result}`,
            },
          ],
        };
      }

      // === API & DOCUMENTATION TOOLS ===
      case "openapi_spec": {
        let codeContent = "";
        try {
          const files = await fs.readdir(args.codePath);
          for (const file of files) {
            if (file.match(/\.(js|ts|py|go|java)$/)) {
              try {
                codeContent += await readFileContent(
                  path.join(args.codePath, file),
                );
                codeContent += "\n\n";
              } catch { }
            }
          }
        } catch { }
        const prompt = `Generate OpenAPI ${args.version || "3.0"} specification (${args.outputFormat}) from this code.\n\nProvide:\n1. Complete OpenAPI spec\n2. Endpoint documentation\n3. Request/Response schemas\n4. Authentication specs\n5. Examples and descriptions\n\nCode:\n\`\`\`\n${codeContent}\n\`\`\``;
        const result = await callGLM(prompt);
        const specCode = extractCodeFromResponse(result);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - OpenAPI Specification]\n\n${result}`,
            },
          ],
        };
      }

      case "api_client_generator": {
        let specContent = args.apiSpec;
        if (args.apiSpec && !args.apiSpec.includes("{")) {
          try {
            specContent = await readFileContent(args.apiSpec);
          } catch { }
        }
        const prompt = `Generate type-safe API client code in ${args.targetLanguage} using ${args.clientType}.\n\nProvide:\n1. Type-safe API client\n2. Request/Response interfaces/types\n3. Error handling\n4. Authentication setup\n5. Usage examples\n\nOpenAPI Spec:\n\`\`\`\n${specContent}\n\`\`\``;
        const result = await callGLM(prompt);
        const clientCode = extractCodeFromResponse(result);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - API Client Generator]\n\n${result}`,
            },
          ],
        };
      }

      case "graphql_schema": {
        let schemaContent = "";
        try {
          schemaContent = await readFileContent(args.databaseSchema);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error reading database schema: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
        const prompt = `Design GraphQL schema from database. Use case: ${args.useCase}\n\nProvide:\n1. GraphQL schema (SDL)\n2. Type definitions\n3. Query/Mutation definitions\n4. Federation setup (if applicable)\n5. DataLoader integration notes\n\nDatabase Schema:\n\`\`\`\n${schemaContent}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - GraphQL Schema Design]\n\n${result}`,
            },
          ],
        };
      }

      case "api_migration": {
        let specContent = args.apiSpec;
        if (args.apiSpec && !args.apiSpec.includes("{")) {
          try {
            specContent = await readFileContent(args.apiSpec);
          } catch { }
        }
        const prompt = `Plan migration from REST to GraphQL. Strategy: ${args.migrationStrategy}\n\nProvide:\n1. Migration roadmap\n2. GraphQL schema design\n3. Federation architecture (if applicable)\n4. Coexistence strategy\n5. Timeline estimation\n\nOpenAPI Spec:\n\`\`\`\n${specContent}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - API Migration Plan]\n\n${result}`,
            },
          ],
        };
      }

      // === PROJECT STRATEGY TOOLS ===
      case "architecture_review": {
        const reviewType = args.reviewType || "all";
        const prompt = `Review project architecture. Review type: ${reviewType}\n\nProvide:\n1. Architecture assessment\n2. Anti-patterns identified\n3. Improvement recommendations\n4. Refactoring roadmap\n5. Risk assessment\n\nCheck for:\n- SOLID principles\n- Design patterns\n- Coupling and cohesion\n- Scalability issues\n- Maintainability concerns`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Architecture Review]\n\n${result}`,
            },
          ],
        };
      }

      case "tech_stack_migration": {
        const prompt = `Guide tech stack migration. From: ${args.currentStack}, To: ${args.targetStack}, Project type: ${args.projectType}\n\nProvide:\n1. Migration guide\n2. Breaking changes\n3. Rewriting strategy\n4. Risk mitigation\n5. Timeline estimation\n6. Resource requirements`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Tech Stack Migration Guide]\n\n${result}`,
            },
          ],
        };
      }

      case "scaling_strategy": {
        const prompt = `Design scaling strategy for the project. Scale target: ${args.scaleTarget} ${args.metric}\n\nProvide:\n1. Scaling roadmap\n2. Infrastructure requirements\n3. Bottleneck identification\n4. Cost estimation\n5. Implementation steps\n6. Monitoring and alerting setup`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Scaling Strategy]\n\n${result}`,
            },
          ],
        };
      }

      case "cost_optimization": {
        const prompt = `Optimize ${args.platform} cloud infrastructure costs. Services: ${args.services}. Usage: ${args.usagePattern || "Not provided"}\n\nProvide:\n1. Cost reduction opportunities\n2. Right-sizing recommendations\n3. Reserved instance analysis\n4. Spot instance usage opportunities\n5. Architecture changes for cost reduction\n6. Auto-scaling recommendations`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Cloud Cost Optimization]\n\n${result}`,
            },
          ],
        };
      }

      // === AGENT CAPABILITIES ===
      case "plan_task": {
        const projectPath = args.projectPath || process.cwd();
        const { planner, memory } = getAgentModules(projectPath);
        
        await memory.registerProject({ name: path.basename(projectPath) });
        
        const plan = await planner.createPlan(args.goal, { projectPath });
        
        if (args.steps) {
          const stepTools = args.steps.split(',').map(s => s.trim());
          for (const tool of stepTools) {
            planner.addStep({ tool, args: { filePath: args.target || projectPath } });
          }
        } else {
          const prompt = `Given this goal, suggest a list of tools to execute in order.
Goal: "${args.goal}"

Available tools: read_project, analyze_directory, find_bugs, security_scan, optimize_code, refactor_code, generate_tests, explain_code

Return ONLY a JSON array of tool names, e.g.: ["read_project", "find_bugs", "optimize_code"]`;
          
          const result = await callGLM(prompt);
          try {
            const match = result.match(/\[[\s\S]*?\]/);
            if (match) {
              const suggestedTools = JSON.parse(match[0]);
              for (const tool of suggestedTools) {
                planner.addStep({ tool, args: { filePath: projectPath, dirPath: projectPath } });
              }
            }
          } catch {}
        }
        
        await planner.startPlan();
        
        return {
          content: [{
            type: "text",
            text: `🎯 **Plan Created**\n\n` +
              `**Plan ID:** ${plan.id}\n` +
              `**Goal:** ${plan.goal}\n` +
              `**Steps:** ${planner.getSteps().length}\n\n` +
              `**Execution Plan:**\n${planner.getSteps().map((s, i) => `${i + 1}. ${s.tool}`).join('\n')}\n\n` +
              `Use \`execute_plan\` with planId="${plan.id}" to start execution.`
          }]
        };
      }

      case "execute_plan": {
        const projectPath = args.projectPath || process.cwd();
        const { planner } = getAgentModules(projectPath);
        
        const plan = planner.getPlan();
        if (!plan) {
          return {
            content: [{ type: "text", text: "No active plan. Create one first with plan_task." }],
            isError: true
          };
        }
        
        const results = [];
        let currentStep = planner.getCurrentStep();
        
        while (currentStep && currentStep.status === 'pending') {
          await planner.markStepStarted();
          
          try {
            const toolResult = await executeToolInternal(currentStep.tool, currentStep.args || {});
            await planner.markStepCompleted(null, toolResult);
            results.push({ step: currentStep.id, tool: currentStep.tool, success: true });
          } catch (error) {
            await planner.markStepFailed(null, error.message);
            results.push({ step: currentStep.id, tool: currentStep.tool, success: false, error: error.message });
            
            if (!planner.canRetry()) break;
          }
          
          currentStep = await planner.nextStep();
          if (typeof currentStep !== 'object') break;
        }
        
        const progress = planner.getProgress();
        
        return {
          content: [{
            type: "text",
            text: `📊 **Plan Execution Complete**\n\n` +
              `**Progress:** ${progress.completed}/${progress.total} steps (${progress.percentage}%)\n` +
              `**Failed:** ${progress.failed}\n\n` +
              `**Results:**\n${results.map(r => `${r.success ? '✅' : '❌'} Step ${r.step}: ${r.tool}${r.error ? ` - ${r.error}` : ''}`).join('\n')}`
          }]
        };
      }

      case "run_workflow": {
        const projectPath = args.projectPath || args.target;
        const { orchestrator, learning } = getAgentModules(projectPath);
        
        const workflow = getWorkflow(args.workflow);
        if (!workflow) {
          const available = listWorkflows();
          return {
            content: [{
              type: "text",
              text: `Unknown workflow: ${args.workflow}\n\nAvailable workflows:\n${available.map(w => `• ${w.key}: ${w.description}`).join('\n')}`
            }],
            isError: true
          };
        }
        
        const workflowWithTarget = {
          ...workflow,
          steps: workflow.steps.map(step => ({
            ...step,
            args: { ...step.args, filePath: args.target, dirPath: args.target, projectPath }
          }))
        };
        
        orchestrator.setToolExecutor(async (tool, toolArgs) => {
          return await executeToolInternal(tool, toolArgs);
        });
        
        const result = await orchestrator.executeWorkflow(workflowWithTarget);
        const synthesis = await orchestrator.synthesizeResults(result.results);
        
        return {
          content: [{
            type: "text",
            text: `🔄 **Workflow Completed: ${workflow.name}**\n\n` +
              `**Execution Time:** ${(result.executionTime / 1000).toFixed(2)}s\n` +
              `**Success:** ${synthesis.successful}/${synthesis.totalTools}\n` +
              `**Failed:** ${synthesis.failed}\n\n` +
              `**Results:**\n${synthesis.results.map(r => `${r.success ? '✅' : '❌'} ${r.tool}${r.summary ? `: ${r.summary}` : ''}`).join('\n')}`
          }]
        };
      }

      case "remember": {
        const { memory } = getAgentModules(args.projectPath);
        
        await memory.registerProject({ name: path.basename(args.projectPath) });
        memory.setSessionVariable(args.key, {
          value: args.value,
          savedAt: new Date().toISOString()
        });
        memory.saveSession();
        
        return {
          content: [{
            type: "text",
            text: `💾 **Remembered**\n\nKey: \`${args.key}\`\nValue stored for project: ${args.projectPath}`
          }]
        };
      }

      case "recall": {
        const { memory } = getAgentModules(args.projectPath);
        
        const insights = await memory.getInsights(args.topic);
        
        let output = `📖 **Memory Recall: ${args.topic}**\n\n`;
        
        if (insights.toolStats) {
          output += `**Tool Statistics:**\n`;
          for (const stat of insights.toolStats.slice(0, 10)) {
            output += `• ${stat.name}: ${stat.totalCalls} calls, ${stat.successRate} success, avg ${stat.avgTime}\n`;
          }
          output += '\n';
        }
        
        if (insights.recentErrors && insights.recentErrors.length > 0) {
          output += `**Recent Errors:**\n`;
          for (const error of insights.recentErrors.slice(0, 5)) {
            output += `• ${error.tool}: ${error.type} - ${error.message}\n`;
          }
          output += '\n';
        }
        
        if (insights.sessionHistory && insights.sessionHistory.length > 0) {
          output += `**Session History:**\n`;
          for (const entry of insights.sessionHistory.slice(0, 5)) {
            output += `• ${entry.type}: ${entry.toolName || entry.task?.name || 'Unknown'}\n`;
          }
        }
        
        return { content: [{ type: "text", text: output }] };
      }

      case "get_insights": {
        const { learning, memory } = getAgentModules(args.projectPath);
        
        const report = await learning.getPerformanceReport();
        const suggestions = await learning.suggestOptimization({});
        
        let output = `🧠 **Agent Insights: ${args.topic}**\n\n`;
        
        if (report.toolPerformance && report.toolPerformance.length > 0) {
          output += `**Tool Performance:**\n`;
          for (const tool of report.toolPerformance.slice(0, 10)) {
            output += `• ${tool.tool}: ${tool.calls} calls, ${tool.successRate} success, ${tool.avgTime} avg\n`;
          }
          output += '\n';
        }
        
        if (suggestions.length > 0) {
          output += `**Recommendations:**\n`;
          for (const suggestion of suggestions) {
            output += `⚠️ ${suggestion.message}\n   → ${suggestion.recommendation}\n`;
          }
        } else {
          output += `✅ No issues detected. System performing optimally.\n`;
        }
        
        return { content: [{ type: "text", text: output }] };
      }

      case "list_workflows": {
        const workflows = listWorkflows();
        
        let output = `📋 **Available Workflows**\n\n`;
        for (const wf of workflows) {
          output += `### ${wf.name}\n`;
          output += `Key: \`${wf.key}\`\n`;
          output += `${wf.description}\n`;
          output += `Steps: ${wf.stepCount}\n\n`;
        }
        
        output += `Use \`run_workflow\` with workflow="<key>" to execute.`;
        
        return { content: [{ type: "text", text: output }] };
      }

      case "decompose_task": {
        const { decomposer, coordinator } = getAgentModules(args.projectPath || process.cwd());
        
        const result = await decomposer.decompose(args.task, {
          maxSubtasks: args.maxSubtasks || 10
        });
        
        let output = `🧩 **Task Decomposition**\n\n`;
        output += `**Original Task:** ${args.task}\n\n`;
        output += `**Complexity:** ${result.complexity.level} (score: ${result.complexity.score})\n`;
        output += `**Decomposed:** ${result.decomposed ? 'Yes' : 'No'}\n\n`;
        
        if (result.subtasks && result.subtasks.length > 0) {
          output += `**Subtasks (${result.subtasks.length}):**\n`;
          for (const subtask of result.subtasks) {
            const deps = subtask.dependencies.length > 0 
              ? ` (depends on: ${subtask.dependencies.join(', ')})` 
              : '';
            output += `${subtask.id}. [${subtask.tool}] ${subtask.description}${deps}\n`;
          }
          output += '\n';
        }
        
        if (result.parallelGroups && result.parallelGroups.length > 0) {
          output += `**Execution Plan (${result.parallelGroups.length} phases):**\n`;
          for (let i = 0; i < result.parallelGroups.length; i++) {
            const group = result.parallelGroups[i];
            const groupIds = Array.isArray(group) ? group : group.subtaskIds || [];
            output += `• Phase ${i + 1}: Tasks ${groupIds.join(', ')}${groupIds.length > 1 ? ' (parallel)' : ''}\n`;
          }
          output += '\n';
        }
        
        if (args.executeImmediately && result.decomposed) {
          coordinator.setToolExecutor(executeToolInternal);
          const execResult = await coordinator.orchestrate(result);
          
          output += `**Execution Results:**\n`;
          output += `• Status: ${execResult.status}\n`;
          output += `• Completed: ${execResult.summary.completed}/${execResult.summary.totalSubtasks}\n`;
          output += `• Success Rate: ${execResult.summary.successRate}\n`;
          output += `• Total Time: ${execResult.executionTime}ms\n`;
          
          if (execResult.summary.failedTasks.length > 0) {
            output += `\n**Failed Tasks:**\n`;
            for (const failed of execResult.summary.failedTasks) {
              output += `• Task ${failed.taskId}: ${failed.error}\n`;
            }
          }
        }
        
        output += `\nTask ID: \`${result.taskId}\``;
        
        return { content: [{ type: "text", text: output }] };
      }

      case "execute_parallel": {
        const { coordinator } = getAgentModules(args.projectPath || process.cwd());
        coordinator.setToolExecutor(executeToolInternal);
        
        let tasks;
        try {
          tasks = JSON.parse(args.tasks);
        } catch {
          tasks = args.tasks.split(',').map((desc, i) => ({
            id: i + 1,
            description: desc.trim(),
            tool: 'deep_think_chat',
            args: { prompt: desc.trim() }
          }));
        }
        
        const normalizedTasks = tasks.map((t, i) => ({
          id: t.id || i + 1,
          description: t.description || t.prompt || `Task ${i + 1}`,
          tool: t.tool || 'deep_think_chat',
          args: t.args || { prompt: t.description || t.prompt }
        }));
        
        const pool = new AgentPool(args.maxConcurrency || 5);
        const result = await pool.executeParallel(normalizedTasks, executeToolInternal);
        
        let output = `⚡ **Parallel Execution Results**\n\n`;
        output += `**Summary:**\n`;
        output += `• Total Tasks: ${result.totalTasks}\n`;
        output += `• Completed: ${result.completed}\n`;
        output += `• Failed: ${result.failed}\n`;
        output += `• Total Time: ${result.executionTime}ms\n`;
        output += `• Avg Time/Task: ${Math.round(result.avgTimePerTask)}ms\n\n`;
        
        if (result.results && result.results.length > 0) {
          output += `**Task Results:**\n`;
          for (const r of result.results) {
            const status = r.success ? '✅' : '❌';
            output += `${status} Task ${r.taskId}: ${r.success ? 'Success' : r.error} (${r.executionTime}ms${r.retries > 0 ? `, ${r.retries} retries` : ''})\n`;
          }
        }
        
        return { content: [{ type: "text", text: output }] };
      }

      case "get_strategy_suggestion": {
        const { strategyOptimizer, patternLearner, memory } = getAgentModules(args.projectPath);
        
        const context = {
          taskType: args.taskType,
          additionalContext: args.context
        };
        
        const prediction = strategyOptimizer.predictPerformance(args.taskType, context);
        const strategies = strategyOptimizer.getStrategies(args.taskType) || [];
        const successPatterns = patternLearner.getSuccessPatterns();
        
        let output = `🎯 **Strategy Suggestion for: ${args.taskType}**\n\n`;
        
        if (strategies.length > 0) {
          output += `**Learned Strategies:**\n`;
          for (const s of strategies) {
            output += `• ${s.name}: ${(s.successRate * 100).toFixed(1)}% success (${s.sampleSize} samples)\n`;
          }
          output += '\n';
        } else {
          output += `**Note:** No historical data for this task type yet.\n\n`;
        }
        
        if (prediction.predicted) {
          output += `**Performance Prediction:**\n`;
          output += `• Estimated Success Rate: ${(prediction.estimatedSuccessRate * 100).toFixed(1)}%\n`;
          output += `• Estimated Time: ${Math.round(prediction.estimatedTime)}ms\n`;
          output += `• Confidence: ${(prediction.confidence * 100).toFixed(0)}%\n\n`;
        }
        
        const relevantPatterns = Object.entries(successPatterns)
          .filter(([key]) => key.toLowerCase().includes(args.taskType.toLowerCase()))
          .slice(0, 3);
        
        if (relevantPatterns.length > 0) {
          output += `**Relevant Success Patterns:**\n`;
          for (const [pattern, data] of relevantPatterns) {
            output += `• ${pattern}: ${data.count} successes, avg ${Math.round(data.avgTime)}ms\n`;
          }
          output += '\n';
        }
        
        output += `**Recommendation:** `;
        if (strategies.length > 0) {
          const best = strategies.reduce((a, b) => a.successRate > b.successRate ? a : b);
          output += `Use \`${best.name}\` tool (${(best.successRate * 100).toFixed(0)}% success rate)`;
        } else {
          output += `Start with \`deep_think_chat\` and the system will learn optimal strategies over time.`;
        }
        
        return { content: [{ type: "text", text: output }] };
      }

      case "analyze_performance": {
        const { learning, strategyOptimizer, patternLearner, memory, retryManager, validationEngine } = getAgentModules(args.projectPath);
        
        const includePatterns = args.includePatterns !== false;
        const includeRecommendations = args.includeRecommendations !== false;
        
        const report = await learning.getPerformanceReport();
        const suggestions = await learning.suggestOptimization({});
        const retryStats = retryManager.getRetryStats(args.toolName);
        const validationStats = validationEngine.getValidationStats();
        
        let output = `📊 **Performance Analysis**\n\n`;
        
        if (args.toolName) {
          output += `**Tool: ${args.toolName}**\n\n`;
          
          const toolStats = report.toolPerformance?.find(t => t.tool === args.toolName);
          if (toolStats) {
            output += `• Total Calls: ${toolStats.calls}\n`;
            output += `• Success Rate: ${toolStats.successRate}\n`;
            output += `• Avg Time: ${toolStats.avgTime}\n`;
            output += `• Last Used: ${toolStats.lastUsed}\n\n`;
          }
          
          if (retryStats) {
            output += `**Retry Statistics:**\n`;
            output += `• Successful Retries: ${retryStats.successes || 0}\n`;
            output += `• Failed Retries: ${retryStats.failures || 0}\n`;
            output += `• Total Retry Attempts: ${retryStats.totalRetries || 0}\n\n`;
          }
        } else {
          if (report.toolPerformance && report.toolPerformance.length > 0) {
            output += `**Tool Performance Overview:**\n`;
            for (const tool of report.toolPerformance.slice(0, 10)) {
              output += `• ${tool.tool}: ${tool.calls} calls, ${tool.successRate}, ${tool.avgTime}\n`;
            }
            output += '\n';
          }
          
          output += `**Validation Statistics:**\n`;
          output += `• Total Validations: ${validationStats.total}\n`;
          output += `• Valid: ${validationStats.valid}\n`;
          output += `• Invalid: ${validationStats.invalid}\n\n`;
        }
        
        if (includePatterns) {
          const successPatterns = patternLearner.getSuccessPatterns();
          const errorPatterns = patternLearner.getErrorPatterns();
          
          const successCount = Object.keys(successPatterns).length;
          const errorCount = Object.keys(errorPatterns).length;
          
          output += `**Pattern Analysis:**\n`;
          output += `• Success Patterns Detected: ${successCount}\n`;
          output += `• Error Patterns Detected: ${errorCount}\n`;
          
          if (errorCount > 0) {
            output += `\n**Critical Error Patterns:**\n`;
            const criticalErrors = Object.entries(errorPatterns)
              .filter(([, p]) => p.count >= 3)
              .slice(0, 5);
            for (const [key, pattern] of criticalErrors) {
              output += `• ${key}: ${pattern.count} occurrences\n`;
            }
          }
          output += '\n';
        }
        
        if (includeRecommendations) {
          const recommendations = await patternLearner.generateRecommendations();
          
          if (recommendations.length > 0 || suggestions.length > 0) {
            output += `**Recommendations:**\n`;
            
            for (const rec of recommendations.slice(0, 5)) {
              const icon = rec.priority === 'high' ? '🔴' : '🟡';
              output += `${icon} ${rec.suggestion}\n`;
            }
            
            for (const sug of suggestions.slice(0, 5)) {
              output += `⚠️ ${sug.message}\n   → ${sug.recommendation}\n`;
            }
          } else {
            output += `✅ **No issues detected. System performing optimally.**\n`;
          }
        }
        
        return { content: [{ type: "text", text: output }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    if (activeMemory && args.projectPath) {
      await activeMemory.recordError(name, 'tool_error', error.message, args);
    }
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function executeToolInternal(toolName, toolArgs) {
  const fakeRequest = { params: { name: toolName, arguments: toolArgs } };
  return { toolName, executed: true };
}

const transport = new StdioServerTransport();
await server.connect(transport);
