import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import dotenv from 'dotenv';

// Only load .env if API key is missing (e.g. local test without MCP config)
// And suppress stdout because dotenv v17+ prints noisy logs that break MCP JSON-RPC
if (!process.env.OPENROUTER_API_KEY) {
  const originalStdoutWrite = process.stdout.write;
  process.stdout.write = () => true; // Mute stdout
  try {
    dotenv.config();
  } catch (e) {
    // Ignore error
  } finally {
    process.stdout.write = originalStdoutWrite; // Restore stdout
  }
}

const execAsync = promisify(exec);

// === GLOBAL ERROR HANDLERS ===
process.on('uncaughtException', (error) => {
  console.error('🚨 KRİTİK HATA (Sunucu çalışmaya devam ediyor):', error);
});

process.on('unhandledRejection', (reason, _promise) => {
  console.error('🚨 Yakalanmayan Promise Hatası:', reason);
});
// =============================

import { MemoryManager } from "./memory/index.js";
import { TaskPlanner } from "./planner/index.js";
import { ToolOrchestrator, RetryManager, ValidationEngine } from "./orchestrator/index.js";
import { SelfImprovement, StrategyOptimizer, PatternLearner } from "./learning/index.js";
import { TaskDecomposer } from "./decomposer/index.js";
import { AgentCoordinator } from "./agents/index.js";
import { callGLM, extractCodeFromResponse } from "./helpers/index.js";
import { readFileContent, writeFileContent } from "./helpers/index.js";
import { buildToolDetectionPrompt } from "./prompts/index.js";
import { setToolExecutor } from "./handlers/agent.js";

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
let currentProjectPath = null;

function getAgentModules(projectPath) {
  if (!projectPath) {
    projectPath = process.cwd();
  }

  if (currentProjectPath !== projectPath) {
    // Clean up old modules if switching projects
    activeMemory = null;
    activePlanner = null;
    activeOrchestrator = null;
    activeLearning = null;
    activeDecomposer = null;
    activeCoordinator = null;
    activeStrategyOptimizer = null;
    activePatternLearner = null;
    activeRetryManager = null;
    activeValidationEngine = null;
    currentProjectPath = projectPath;
  }

  if (!activeMemory) {
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

// Tool execution logic extracted for reuse
async function executeToolLogic(name, args, isInternal = false) {
  // Check modular handlers first
  if (handlers[name]) {
    return await handlers[name](args);
  }

  switch (name) {
    // === AUTO-DETECT (AI-powered tool selection) ===
    // Tools moved to handlers/core.js

    // === CORE TOOLS ===
    // Tools moved to handlers/core.js

    // === FILE OPERATIONS ===
    // Tools moved to handlers/file-ops.js

    // === CODE ANALYSIS ===
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
      } catch (error) {
        console.warn(`Warning: Could not read package.json: ${error.message}`);
      }
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
            const dirPath = path.dirname(fullPath);
            await fs.mkdir(dirPath, { recursive: true });
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
      } catch (error) {
        console.error(`Error creating project structure: ${error.message}`);
        return {
          content: [{ type: "text", text: `[Deep Thinking]\n\nError: ${error.message}\n\n${result}` }],
          isError: true
        };
      }
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
      const workflowDir = path.dirname(workflowPath);
      await fs.mkdir(workflowDir, { recursive: true });
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

      // Extract YAML blocks and write them to files
      const yamlBlocks = result.match(/```yaml[\s\S]*?```/g);
      if (yamlBlocks) {
        for (let i = 0; i < yamlBlocks.length; i++) {
          const content = extractCodeFromResponse(yamlBlocks[i]);
          const fileName = `resource-${i + 1}.yaml`;
          await writeFileContent(path.join(k8sDir, fileName), content);
        }
      }
      return {
        content: [{ type: "text", text: `[Deep Thinking - K8s Manifests]\n\nManifests created in: ${args.projectPath}/k8s` }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await executeToolLogic(name, args);
    return result;
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Initialize automation by injecting the tool executor
setToolExecutor(executeToolLogic);

const transport = new StdioServerTransport();
await server.connect(transport);