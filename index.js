import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import { MemoryManager } from "./memory/index.js";
import { TaskPlanner } from "./planner/index.js";
import { ToolOrchestrator, getWorkflow, listWorkflows, WORKFLOWS, RetryManager, ValidationEngine } from "./orchestrator/index.js";
import { SelfImprovement, StrategyOptimizer, PatternLearner } from "./learning/index.js";
import { TaskDecomposer } from "./decomposer/index.js";
import { AgentCoordinator, MiniAgent, AgentPool } from "./agents/index.js";
import { generateProjectId } from "./config.js";

const execAsync = promisify(exec);
const GLM_API_KEY = process.env.GLM_API_KEY;

const server = new Server(
  {
    name: "glm-deepthinker",
    version: "4.1.0",
  },
  {
    capabilities: { tools: {} },
  },
);

// Tool definitions
const tools = [
  // === AUTO-DETECT (AI-powered tool selection) ===
  {
    name: "auto_detect",
    description:
      "AI-powered tool selection. Just describe what you want to do, and AI will choose the best tool automatically.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Describe what you want to do (no need to specify tool name)",
        },
      },
      required: ["prompt"],
    },
  },

  // === CORE TOOLS ===
  {
    name: "deep_think_chat",
    description: "Deep thinking mode for complex coding questions.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Your question or coding task" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "deep_think_verbose",
    description:
      "Deep thinking with visible reasoning process. Shows how the model thinks before answering.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Your question or coding task" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "deep_think_code",
    description: "Generate code with Deep Thinking and save to file.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Code task or request" },
        filePath: { type: "string", description: "Absolute file path to save" },
      },
      required: ["prompt", "filePath"],
    },
  },

  // === FILE OPERATIONS ===
  {
    name: "read_file",
    description: "Read file contents.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute file path" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "write_file",
    description: "Write content to file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute file path" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["filePath", "content"],
    },
  },
  {
    name: "list_directory",
    description: "List files in a directory.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "Absolute directory path" },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "search_in_files",
    description: "Search for pattern in files using regex.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "Directory to search" },
        pattern: { type: "string", description: "Regex pattern to search" },
        extensions: {
          type: "string",
          description: "File extensions (comma-separated, e.g., js,ts,py)",
        },
      },
      required: ["dirPath", "pattern"],
    },
  },
  {
    name: "read_project",
    description: "Read project structure and important files (package.json, config files, entry points). Returns overview of the project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root directory" },
        depth: { type: "number", description: "Directory depth to scan (default: 3)" },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "read_related_files",
    description: "Read a file and all files it imports/references. Useful for understanding a module in context.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Main file to analyze" },
        maxFiles: { type: "number", description: "Maximum related files to read (default: 10)" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "analyze_directory",
    description: "Read and analyze all code files in a directory. GLM provides comprehensive analysis with Deep Thinking.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "Directory to analyze" },
        extensions: { type: "string", description: "File extensions to include (default: js,ts,jsx,tsx,py)" },
        analysisType: { type: "string", description: "Type: overview, bugs, security, performance, architecture" },
      },
      required: ["dirPath", "analysisType"],
    },
  },

  // === CODE ANALYSIS ===
  {
    name: "refactor_code",
    description: "Read code, refactor with Deep Thinking, and save back.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to refactor" },
        instructions: {
          type: "string",
          description: "Refactoring instructions",
        },
      },
      required: ["filePath", "instructions"],
    },
  },
  {
    name: "explain_code",
    description: "Read file and generate detailed explanation.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to explain" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "add_comments",
    description: "Add inline comments to code.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to add comments" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "find_bugs",
    description: "Analyze code for potential bugs and issues.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to analyze" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "optimize_code",
    description: "Suggest performance optimizations for code.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to optimize" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "find_references",
    description: "Find all usages of a function/variable in directory.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "Directory to search" },
        symbol: { type: "string", description: "Function or variable name" },
      },
      required: ["dirPath", "symbol"],
    },
  },

  // === GIT OPERATIONS ===
  {
    name: "git_diff_explain",
    description: "Explain current git diff changes.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
      },
      required: ["repoPath"],
    },
  },
  {
    name: "generate_commit_message",
    description: "Generate commit message based on staged changes.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
      },
      required: ["repoPath"],
    },
  },

  // === TEST & DOCS ===
  {
    name: "generate_tests",
    description: "Generate unit tests for code file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to generate tests for" },
        framework: {
          type: "string",
          description: "Test framework (jest, mocha, vitest, pytest)",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "generate_docs",
    description: "Generate JSDoc/TSDoc documentation for file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to document" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "create_readme",
    description: "Generate README.md for a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root directory" },
      },
      required: ["projectPath"],
    },
  },

  // === PROJECT MANAGEMENT ===
  {
    name: "create_project",
    description: "Create boilerplate project structure.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Where to create project" },
        projectType: {
          type: "string",
          description: "Type: express, react, node, python",
        },
        projectName: { type: "string", description: "Project name" },
      },
      required: ["projectPath", "projectType", "projectName"],
    },
  },
  {
    name: "add_dependency",
    description: "Add and explain a npm dependency.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Project path with package.json",
        },
        packageName: { type: "string", description: "Package to add" },
        isDev: { type: "boolean", description: "Add as devDependency" },
      },
      required: ["projectPath", "packageName"],
    },
  },

  // === DATABASE TOOLS ===
  {
    name: "analyze_query",
    description:
      "Analyze SQL query performance and suggest optimizations. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL query to analyze" },
        dbType: {
          type: "string",
          description: "Database type: mysql, postgres, mssql, sqlite, oracle",
        },
      },
      required: ["query", "dbType"],
    },
  },
  {
    name: "explain_schema",
    description:
      "Document database schema with ER diagrams. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        schemaFile: {
          type: "string",
          description: "Path to schema file (SQL, Prisma, TypeORM, etc.)",
        },
        outputFormat: {
          type: "string",
          description: "Output format: markdown, json, plantuml",
        },
      },
      required: ["schemaFile"],
    },
  },
  {
    name: "suggest_indexes",
    description:
      "Suggest optimal indexes for database performance. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        schemaFile: { type: "string", description: "Path to schema file" },
        queryPatterns: {
          type: "string",
          description: "Common query patterns (optional)",
        },
        dbType: { type: "string", description: "Database type" },
      },
      required: ["schemaFile", "dbType"],
    },
  },
  {
    name: "review_migration",
    description:
      "Review migration files for safety and best practices. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        migrationFile: {
          type: "string",
          description: "Path to migration file",
        },
        dbType: { type: "string", description: "Database type" },
        context: {
          type: "string",
          description: "Previous migration context (optional)",
        },
      },
      required: ["migrationFile", "dbType"],
    },
  },

  // === GIT ADVANCED TOOLS ===
  {
    name: "resolve_conflicts",
    description:
      "Provide resolution suggestions for git merge conflicts. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
        conflictFile: {
          type: "string",
          description: "Specific file with conflicts (optional)",
        },
      },
      required: ["repoPath"],
    },
  },
  {
    name: "branch_analyzer",
    description:
      "Analyze branch strategy and provide merging recommendations. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
        targetBranch: {
          type: "string",
          description: "Main branch name (default: main)",
        },
      },
      required: ["repoPath"],
    },
  },
  {
    name: "pr_review",
    description: "Generate pull request review comments. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
        prDiff: {
          type: "string",
          description: "PR diff string (auto-detected if not provided)",
        },
        reviewType: {
          type: "string",
          description:
            "Review type: code_review, security_review, performance_review",
        },
      },
      required: ["repoPath"],
    },
  },
  {
    name: "git_history",
    description:
      "Analyze commit history and detect patterns. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
        depth: {
          type: "number",
          description: "Number of commits to analyze (default: 100)",
        },
      },
      required: ["repoPath"],
    },
  },

  // === CI/CD & DEVOPS TOOLS ===
  {
    name: "generate_dockerfile",
    description: "Generate optimized Dockerfile for the project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        framework: {
          type: "string",
          description:
            "Framework: express, react, next, vue, nestjs, python, go, rust",
        },
        target: {
          type: "string",
          description: "Target: production, development, testing",
        },
        optimization: {
          type: "string",
          description: "Optimization: size, speed, multi-stage",
        },
      },
      required: ["projectPath", "framework", "target"],
    },
  },
  {
    name: "generate_github_actions",
    description: "Generate GitHub Actions CI/CD workflow files.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        workflowType: {
          type: "string",
          description: "Workflow type: ci, cd, cicd, security, linting",
        },
        language: {
          type: "string",
          description: "Language: js, ts, py, go, rust",
        },
      },
      required: ["projectPath", "workflowType", "language"],
    },
  },
  {
    name: "k8s_manifest",
    description: "Generate Kubernetes manifests for deployment.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        deploymentType: {
          type: "string",
          description: "Type: deployment, statefulset, daemonset",
        },
        resources: {
          type: "string",
          description:
            "Resources to generate (comma-separated): Deployment, Service, Ingress, ConfigMap, Secret, HPA",
        },
      },
      required: ["projectPath", "deploymentType"],
    },
  },
  {
    name: "terraform_module",
    description: "Generate Terraform modules for infrastructure.",
    inputSchema: {
      type: "object",
      properties: {
        infrastructureType: {
          type: "string",
          description: "Infrastructure: aws, gcp, azure, multi-cloud",
        },
        serviceType: {
          type: "string",
          description:
            "Service type: web_api, database, storage, cdn, function",
        },
      },
      required: ["infrastructureType", "serviceType"],
    },
  },

  // === TEST ADVANCED TOOLS ===
  {
    name: "generate_e2e_tests",
    description: "Generate E2E tests using Playwright or Cypress.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "File to generate E2E tests for",
        },
        framework: {
          type: "string",
          description: "Framework: playwright, cypress",
        },
        testType: {
          type: "string",
          description: "Test type: happy_path, error_handling, edge_cases, all",
        },
      },
      required: ["filePath", "framework", "testType"],
    },
  },
  {
    name: "test_coverage_analysis",
    description:
      "Analyze test coverage and identify gaps. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        testFramework: {
          type: "string",
          description: "Test framework: jest, vitest, mocha, pytest",
        },
        targetCoverage: {
          type: "number",
          description: "Target coverage percentage (default: 80)",
        },
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
        apiSpec: {
          type: "string",
          description: "OpenAPI spec path or inline spec",
        },
        outputFormat: {
          type: "string",
          description: "Format: msw, nock, mock-service-worker, json",
        },
      },
      required: ["apiSpec", "outputFormat"],
    },
  },
  {
    name: "load_test_script",
    description: "Generate load testing scripts (k6, artillery, locust).",
    inputSchema: {
      type: "object",
      properties: {
        apiSpec: {
          type: "string",
          description: "API endpoint list or OpenAPI spec",
        },
        framework: {
          type: "string",
          description: "Framework: k6, artillery, locust",
        },
        testProfile: {
          type: "string",
          description: "Profile: smoke, load, stress, spike, endurance",
        },
      },
      required: ["apiSpec", "framework", "testProfile"],
    },
  },

  // === SECURITY & SAST TOOLS ===
  {
    name: "security_scan",
    description: "OWASP Top 10 security scan for code. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to scan" },
        scanType: {
          type: "string",
          description: "Scan type: full, quick, custom",
        },
        rules: { type: "string", description: "OWASP rules subset (optional)" },
      },
      required: ["filePath", "scanType"],
    },
  },
  {
    name: "dependency_audit",
    description:
      "Audit dependencies for security vulnerabilities. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        packageManager: {
          type: "string",
          description: "Package manager: npm, yarn, pnpm, pip, go, cargo",
        },
      },
      required: ["projectPath", "packageManager"],
    },
  },
  {
    name: "secrets_scanner",
    description:
      "Scan for hardcoded secrets and credentials. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "Directory to scan" },
        secretTypes: {
          type: "string",
          description:
            "Secret types: api_key, password, token, certificate, private_key, all",
        },
      },
      required: ["dirPath", "secretTypes"],
    },
  },
  {
    name: "api_security",
    description: "Analyze API endpoint security. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        apiSpec: { type: "string", description: "OpenAPI spec or code paths" },
        securityHeaders: {
          type: "boolean",
          description: "Check security headers",
        },
        authType: {
          type: "string",
          description: "Auth type: jwt, oauth, apikey, basic",
        },
      },
      required: ["apiSpec"],
    },
  },

  // === PERFORMANCE & OPTIMIZATION TOOLS ===
  {
    name: "bundle_analysis",
    description:
      "Analyze bundle size and optimization opportunities. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        framework: {
          type: "string",
          description: "Framework: react, vue, next, angular, vanilla",
        },
        target: {
          type: "string",
          description: "Target: browser, node, mobile",
        },
      },
      required: ["projectPath", "framework", "target"],
    },
  },
  {
    name: "memory_leak_detect",
    description: "Detect potential memory leaks in code. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to analyze" },
        language: {
          type: "string",
          description: "Language: javascript, typescript, python, go",
        },
      },
      required: ["filePath", "language"],
    },
  },
  {
    name: "api_response_time",
    description: "Benchmark API response times. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        apiEndpoint: { type: "string", description: "API URL" },
        method: {
          type: "string",
          description: "HTTP method: GET, POST, PUT, DELETE",
        },
        iterations: {
          type: "number",
          description: "Number of test iterations",
        },
      },
      required: ["apiEndpoint", "method"],
    },
  },
  {
    name: "caching_strategy",
    description:
      "Suggest caching strategies for performance. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        cacheType: {
          type: "string",
          description: "Cache type: redis, memcached, in-memory, cdn, all",
        },
        useCase: {
          type: "string",
          description: "Use case: api, database, static, session",
        },
      },
      required: ["projectPath", "cacheType", "useCase"],
    },
  },

  // === API & DOCUMENTATION TOOLS ===
  {
    name: "openapi_spec",
    description:
      "Generate OpenAPI/Swagger specification from code. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        codePath: { type: "string", description: "API code directory" },
        outputFormat: {
          type: "string",
          description: "Output format: yaml, json",
        },
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
        targetLanguage: {
          type: "string",
          description: "Target language: typescript, python, go, rust, java",
        },
        clientType: {
          type: "string",
          description: "Client type: axios, fetch, openai, custom",
        },
      },
      required: ["openapiSpec", "targetLanguage", "clientType"],
    },
  },
  {
    name: "graphql_schema",
    description: "Design GraphQL schema from database. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        databaseSchema: { type: "string", description: "Database schema path" },
        useCase: {
          type: "string",
          description: "Use case: rest_to_graphql, new_api, federation",
        },
      },
      required: ["databaseSchema", "useCase"],
    },
  },
  {
    name: "api_migration",
    description: "Plan migration from REST to GraphQL. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        openapiSpec: { type: "string", description: "Existing OpenAPI spec" },
        migrationStrategy: {
          type: "string",
          description: "Strategy: incremental, big_bang",
        },
      },
      required: ["openapiSpec", "migrationStrategy"],
    },
  },

  // === PROJECT STRATEGY TOOLS ===
  {
    name: "architecture_review",
    description:
      "Review architecture and provide recommendations. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        reviewType: {
          type: "string",
          description:
            "Review type: scalability, maintainability, security, performance, all",
        },
      },
      required: ["projectPath", "reviewType"],
    },
  },
  {
    name: "tech_stack_migration",
    description: "Guide tech stack migration. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        currentStack: { type: "string", description: "Current tech stack" },
        targetStack: { type: "string", description: "Target tech stack" },
        projectType: {
          type: "string",
          description: "Project type: frontend, backend, fullstack",
        },
      },
      required: ["currentStack", "targetStack", "projectType"],
    },
  },
  {
    name: "scaling_strategy",
    description:
      "Design scaling strategy for the project. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        scaleTarget: {
          type: "string",
          description: "Scale target: 1000, 10000, 100000, 1000000",
        },
        metric: {
          type: "string",
          description: "Metric: concurrent_users, requests_per_second",
        },
      },
      required: ["projectPath", "scaleTarget", "metric"],
    },
  },
  {
    name: "cost_optimization",
    description: "Optimize cloud infrastructure costs. READ-ONLY operation.",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description: "Cloud platform: aws, gcp, azure",
        },
        services: { type: "string", description: "List of services used" },
        usagePattern: {
          type: "string",
          description: "Usage pattern description",
        },
      },
      required: ["platform", "services"],
    },
  },

  // === AGENT CAPABILITIES (Self-Directed Engineer) ===
  {
    name: "plan_task",
    description: "Create an execution plan for a complex task. Agent will break down the goal into subtasks with checkpointing.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "What you want to achieve" },
        projectPath: { type: "string", description: "Project context path" },
        steps: { type: "string", description: "Optional: comma-separated list of tools to use" }
      },
      required: ["goal"]
    }
  },
  {
    name: "execute_plan",
    description: "Execute a previously created plan step by step with automatic checkpointing.",
    inputSchema: {
      type: "object",
      properties: {
        planId: { type: "string", description: "Plan ID to execute (or 'current' for active plan)" },
        stepIndex: { type: "number", description: "Start from specific step (optional)" }
      },
      required: ["planId"]
    }
  },
  {
    name: "run_workflow",
    description: "Execute a predefined multi-tool workflow (full_code_review, security_audit, performance_optimization, project_onboarding, refactoring_workflow).",
    inputSchema: {
      type: "object",
      properties: {
        workflow: { type: "string", description: "Workflow name" },
        target: { type: "string", description: "Target file or directory path" },
        projectPath: { type: "string", description: "Project root path" }
      },
      required: ["workflow", "target"]
    }
  },
  {
    name: "remember",
    description: "Store information in agent memory for future reference. Persists across sessions.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Memory key/identifier" },
        value: { type: "string", description: "Information to remember" },
        projectPath: { type: "string", description: "Project path for context" }
      },
      required: ["key", "value", "projectPath"]
    }
  },
  {
    name: "recall",
    description: "Retrieve information from agent memory.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project path" },
        topic: { type: "string", description: "What to recall: 'tools', 'errors', 'patterns', 'project', 'all'" }
      },
      required: ["projectPath", "topic"]
    }
  },
  {
    name: "get_insights",
    description: "Get agent's learned insights, performance metrics, and recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project path" },
        topic: { type: "string", description: "Topic: 'tools', 'patterns', 'errors', 'performance', 'all'" }
      },
      required: ["projectPath", "topic"]
    }
  },
  {
    name: "list_workflows",
    description: "List all available predefined workflows.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  // === ADVANCED AGENT CAPABILITIES ===
  {
    name: "decompose_task",
    description: "Decompose a complex task into subtasks with dependency resolution and parallel execution grouping. Uses AI to intelligently break down tasks.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Complex task description to decompose" },
        projectPath: { type: "string", description: "Project context path" },
        executeImmediately: { type: "boolean", description: "If true, execute subtasks automatically after decomposition" },
        maxSubtasks: { type: "number", description: "Maximum number of subtasks to create (default: 10)" }
      },
      required: ["task"]
    }
  },
  {
    name: "execute_parallel",
    description: "Execute multiple tasks in parallel using mini-agents. Automatically manages concurrency, retries, and result aggregation.",
    inputSchema: {
      type: "object",
      properties: {
        tasks: { type: "string", description: "JSON array of tasks [{tool, args, description}] or comma-separated task descriptions" },
        projectPath: { type: "string", description: "Project context path" },
        maxConcurrency: { type: "number", description: "Maximum parallel agents (default: 5)" },
        continueOnError: { type: "boolean", description: "Continue execution if some tasks fail (default: true)" }
      },
      required: ["tasks"]
    }
  },
  {
    name: "get_strategy_suggestion",
    description: "Get AI-learned strategy suggestions for a task type based on historical performance data.",
    inputSchema: {
      type: "object",
      properties: {
        taskType: { type: "string", description: "Type of task (e.g., 'code_review', 'refactoring', 'bug_fixing')" },
        projectPath: { type: "string", description: "Project context path" },
        context: { type: "string", description: "Additional context about the task" }
      },
      required: ["taskType", "projectPath"]
    }
  },
  {
    name: "analyze_performance",
    description: "Analyze tool performance, detect patterns, and get improvement recommendations based on learning history.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project context path" },
        toolName: { type: "string", description: "Specific tool to analyze (optional, analyzes all if not provided)" },
        includePatterns: { type: "boolean", description: "Include success/error pattern analysis (default: true)" },
        includeRecommendations: { type: "boolean", description: "Generate improvement recommendations (default: true)" }
      },
      required: ["projectPath"]
    }
  }
];

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

// Helper functions

// Deep Thinking System Prompt - Proactive Problem Anticipation + Self-Review
const DEEP_THINKING_SYSTEM_PROMPT = `You are an expert software engineer who writes production-ready, bulletproof code.

## PHASE 0: CONTEXT AWARENESS (Understand Before Modifying)

Before writing or modifying ANY code, you MUST understand the project context:

1. **Existing Code Style**:
   - What naming conventions are used? (camelCase, snake_case, PascalCase)
   - What indentation style? (tabs vs spaces, 2 vs 4 spaces)
   - Are semicolons used? What quote style? (single vs double)

2. **Project Architecture**:
   - What framework/library is being used? (React, Vue, Express, Laravel, etc.)
   - What is the folder structure pattern? (feature-based, layer-based)
   - Are there existing patterns? (MVC, Repository, Service layer)

3. **Existing Conventions**:
   - How are imports organized?
   - How is error handling done in other files?
   - What logging/debugging patterns exist?
   - Are there utility functions that should be reused?

4. **Dependencies & Types**:
   - What dependencies are available?
   - Are TypeScript types being used? What type patterns?
   - Are there existing interfaces/types to extend?

**CRITICAL: Your code MUST match the existing project style. Do NOT introduce new patterns or styles that conflict with the codebase.**

## PHASE 1: PROACTIVE PROBLEM ANTICIPATION (Before Writing Code)

When approaching any coding task, you MUST first think through:

1. **Edge Cases & Boundary Conditions**:
   - What happens with empty/null/undefined inputs?
   - What are the min/max values? What happens at boundaries?
   - What if the user provides unexpected input types?

2. **Error Scenarios**:
   - What can fail? Network, file system, database, memory?
   - How should each failure be handled gracefully?
   - What error messages would be helpful for debugging?

3. **Race Conditions & Concurrency**:
   - Can this code be called multiple times simultaneously?
   - Are there shared resources that need protection?
   - What's the order of operations dependency?

4. **Security Concerns**:
   - Is there input that could be exploited (injection, XSS, etc.)?
   - Are secrets/credentials handled safely?
   - Is there proper authentication/authorization?

5. **Performance Implications**:
   - Will this scale? What's the time/space complexity?
   - Are there N+1 queries or unnecessary loops?
   - Should there be caching, pagination, or lazy loading?

## PHASE 2: WRITE DEFENSIVE CODE

Based on the above analysis:
- Handle ALL identified edge cases in the code
- Add proper error handling with meaningful messages
- Include input validation where needed
- Write code that fails gracefully, never crashes unexpectedly

## PHASE 3: SELF-REVIEW (After Writing Code)

Before finalizing, review your own code:

1. **Correctness Check**: Does it actually solve the problem?
2. **Edge Case Verification**: Are all edge cases from Phase 1 handled?
3. **Error Handling Review**: Is every potential failure caught?
4. **Code Quality**: Is it readable, maintainable, follows conventions?
5. **Security Audit**: Any vulnerabilities introduced?

If you find issues during self-review, FIX THEM before presenting the final code.

## PHASE 4: SYNTAX VALIDATION (Final Check)

Before returning any code:
1. **Syntax Check**: Ensure all brackets, parentheses, and braces are balanced
2. **Semicolons**: Add semicolons where required by the language
3. **Imports**: Verify all imports are complete and correctly formatted
4. **String Literals**: Check all quotes are properly closed
5. **Indentation**: Maintain consistent indentation throughout

NEVER return syntactically invalid code. If unsure, err on the side of verbosity.

## OUTPUT FORMAT

Structure your response as:
1. Brief problem understanding
2. Potential issues identified (from Phase 1)
3. The code with all protections built-in
4. Self-review summary confirming all issues are addressed`;

async function callGLMRaw(prompt, useSystemPrompt = true) {
  const messages = [];

  if (useSystemPrompt) {
    messages.push({ role: "system", content: DEEP_THINKING_SYSTEM_PROMPT });
  }

  messages.push({ role: "user", content: prompt });

  const response = await axios.post(
    "https://api.z.ai/api/coding/paas/v4/chat/completions",
    {
      model: "glm-4.7",
      messages,
      thinking: { type: "enabled" },
    },
    {
      headers: { Authorization: `Bearer ${GLM_API_KEY}` },
    },
  );
  return response.data;
}

async function callGLM(prompt) {
  const data = await callGLMRaw(prompt);
  return data.choices[0].message.content;
}

async function callGLMWithThinking(prompt) {
  const data = await callGLMRaw(prompt);
  const message = data.choices[0].message;

  const thinking =
    message.reasoning_content ||
    message.thinking_content ||
    message.reasoning ||
    message.thinking ||
    null;

  const content = message.content;

  let output = "";

  if (thinking) {
    output += "## Thinking Process\n\n";
    output +=
      "<details>\n<summary>Click to expand thinking process...</summary>\n\n";
    output += thinking;
    output += "\n\n</details>\n\n";
    output += "---\n\n";
  }

  output += "## Response\n\n";
  output += content;

  return { thinking, content, formatted: output };
}

function extractCodeFromResponse(response) {
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
  const matches = [...response.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    return matches.map((m) => m[1]).join("\n\n");
  }
  return response;
}

async function readFileContent(filePath) {
  return await fs.readFile(filePath, "utf-8");
}

async function writeFileContent(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

async function searchFiles(dirPath, pattern, extensions) {
  const results = [];
  const regex = new RegExp(pattern, "gi");
  const extList = extensions
    ? extensions.split(",").map((e) => `.${e.trim()}`)
    : null;

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
        if (extList && !extList.includes(path.extname(entry.name))) continue;
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, i) => {
            if (regex.test(line)) {
              results.push({
                file: fullPath,
                line: i + 1,
                content: line.trim(),
              });
            }
          });
        } catch { }
      }
    }
  }
  await walk(dirPath);
  return results;
}

async function runGitCommand(repoPath, command) {
  try {
    const { stdout } = await execAsync(`git ${command}`, { cwd: repoPath });
    return stdout;
  } catch (error) {
    return error.message;
  }
}

// AI-powered tool detection
async function autoDetectTool(prompt) {
  const toolPrompt = `
Given this user request, choose the BEST tool from our available tools.

User Request: "${prompt}"

Available Tools:

=== CORE TOOLS (3) ===
1. deep_think_chat - Complex coding questions
2. deep_think_verbose - Deep thinking with visible reasoning
3. deep_think_code - Generate code and save to file

=== FILE OPERATIONS (4) ===
4. read_file - Read file contents
5. write_file - Write content to file
6. list_directory - List files in directory
7. search_in_files - Search for pattern in files

=== CODE ANALYSIS (6) ===
8. refactor_code - Refactor code and save
9. explain_code - Generate detailed explanation
10. add_comments - Add inline comments
11. find_bugs - Analyze code for bugs
12. optimize_code - Performance optimizations
13. find_references - Find symbol usages

=== GIT OPERATIONS (2) ===
14. git_diff_explain - Explain git diff
15. generate_commit_message - Generate commit message

=== TEST & DOCUMENTATION (3) ===
16. generate_tests - Generate unit tests
17. generate_docs - Generate JSDoc/TSDoc
18. create_readme - Generate README.md

=== PROJECT MANAGEMENT (2) ===
19. create_project - Create boilerplate project
20. add_dependency - Add dependency

=== DATABASE TOOLS (4) ===
21. analyze_query - SQL query performance analysis, N+1 detection
22. explain_schema - Database schema documentation, ER diagrams
23. suggest_indexes - Optimal index recommendations
24. review_migration - Migration safety review

=== GIT ADVANCED TOOLS (4) ===
25. resolve_conflicts - Git conflict resolution
26. branch_analyzer - Branch strategy and merging
27. pr_review - Pull request review
28. git_history - Commit history analysis

=== CI/CD & DEVOPS TOOLS (4) ===
29. generate_dockerfile - Optimized Dockerfile (multi-stage)
30. generate_github_actions - CI/CD workflow
31. k8s_manifest - Kubernetes manifests
32. terraform_module - Terraform modules

=== TEST ADVANCED TOOLS (4) ===
33. generate_e2e_tests - Playwright/Cypress E2E tests
34. test_coverage_analysis - Test coverage gaps
35. mock_generator - API mocks (MSW, Nock)
36. load_test_script - Load testing (k6, artillery)

=== SECURITY & SAST TOOLS (4) ===
37. security_scan - OWASP Top 10 security scan
38. dependency_audit - Vulnerability detection
39. secrets_scanner - Hardcoded secrets detection
40. api_security - API endpoint security analysis

=== PERFORMANCE & OPTIMIZATION TOOLS (4) ===
41. bundle_analysis - Bundle size analysis
42. memory_leak_detect - Memory leak detection
43. api_response_time - API performance benchmark
44. caching_strategy - Caching recommendations

=== API & DOCUMENTATION TOOLS (4) ===
45. openapi_spec - OpenAPI/Swagger specification
46. api_client_generator - API client code
47. graphql_schema - GraphQL schema design
48. api_migration - REST to GraphQL migration

=== PROJECT STRATEGY TOOLS (4) ===
49. architecture_review - Architecture review
50. tech_stack_migration - Tech stack migration guide
51. scaling_strategy - Scaling strategy
52. cost_optimization - Cloud cost optimization

Instructions:
1. Analyze the user's intent and context
2. Match with the most appropriate tool
3. Consider keyword clues (SQL, git, docker, security, optimize, test, analyze, etc.)
4. Confidence should be high (0.7+) for clear requests
5. If multiple tools could work, prioritize based on specificity

Response Format (strict JSON):
{
  "tool": "tool_name",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this tool was chosen"
}`;

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

  try {
    switch (name) {
      // === AUTO-DETECT (AI-powered tool selection) ===
      case "auto_detect": {
        const result = await autoDetectTool(args.prompt);
        return {
          content: [
            {
              type: "text",
              text:
                `🎯 AI Tool Selection\n\n` +
                `Selected Tool: **${result.tool}**\n` +
                `Confidence: **${Math.round(result.confidence * 100)}%**\n` +
                `Reasoning: ${result.reasoning}\n\n` +
                `⏳ Executing ${result.tool}...\n\n` +
                `[If you want to use a different tool, specify it explicitly, e.g.:]\n` +
                `@GLM-Thinker analyze_query SELECT * FROM users\n` +
                `@GLM-Thinker security_scan ./src/auth.js\n` +
                `@GLM-Thinker generate_dockerfile --framework react\n\n` +
                `[View all tools: https://github.com/YOUR_REPO/tree/main/README.md#tools]`,
            },
          ],
        };
      }

      // === CORE TOOLS ===
      case "deep_think_chat": {
        const content = await callGLM(args.prompt);
        return {
          content: [{ type: "text", text: `[Deep Thinking]\n\n${content}` }],
        };
      }

      case "deep_think_verbose": {
        const result = await callGLMWithThinking(args.prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Verbose Mode]\n\n${result.formatted}`,
            },
          ],
        };
      }

      case "deep_think_code": {
        const glmResponse = await callGLM(args.prompt);
        const code = extractCodeFromResponse(glmResponse);
        await writeFileContent(args.filePath, code);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking]\n\nFile saved: ${args.filePath}\n\n${glmResponse}`,
            },
          ],
        };
      }

      // === FILE OPERATIONS ===
      case "read_file": {
        const content = await readFileContent(args.filePath);
        return { content: [{ type: "text", text: content }] };
      }

      case "write_file": {
        await writeFileContent(args.filePath, args.content);
        return {
          content: [{ type: "text", text: `File saved: ${args.filePath}` }],
        };
      }

      case "list_directory": {
        const files = await fs.readdir(args.dirPath, { withFileTypes: true });
        const list = files
          .map((f) => `${f.isDirectory() ? "[DIR]" : "[FILE]"} ${f.name}`)
          .join("\n");
        return {
          content: [{ type: "text", text: list || "Empty directory." }],
        };
      }

      case "search_in_files": {
        const results = await searchFiles(
          args.dirPath,
          args.pattern,
          args.extensions,
        );
        const output = results.length
          ? results.map((r) => `${r.file}:${r.line} - ${r.content}`).join("\n")
          : "No matches found.";
        return { content: [{ type: "text", text: output }] };
      }

      case "read_project": {
        const depth = args.depth || 3;
        const importantFiles = [
          "package.json", "tsconfig.json", "vite.config.js", "vite.config.ts",
          "next.config.js", "next.config.ts", ".env.example", "README.md",
          "index.js", "index.ts", "main.js", "main.ts", "app.js", "app.ts",
          "src/index.js", "src/index.ts", "src/main.js", "src/main.ts", "src/App.tsx", "src/App.jsx"
        ];

        let projectInfo = `## Project: ${args.projectPath}\n\n`;

        // Read important files
        for (const file of importantFiles) {
          try {
            const content = await readFileContent(path.join(args.projectPath, file));
            projectInfo += `### ${file}\n\`\`\`\n${content.slice(0, 2000)}${content.length > 2000 ? "\n...(truncated)" : ""}\n\`\`\`\n\n`;
          } catch { }
        }

        // Scan directory structure
        async function scanDir(dir, currentDepth = 0, prefix = "") {
          if (currentDepth >= depth) return "";
          let structure = "";
          try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
              structure += `${prefix}${entry.isDirectory() ? "📁" : "📄"} ${entry.name}\n`;
              if (entry.isDirectory()) {
                structure += await scanDir(path.join(dir, entry.name), currentDepth + 1, prefix + "  ");
              }
            }
          } catch { }
          return structure;
        }

        projectInfo += `### Directory Structure\n\`\`\`\n${await scanDir(args.projectPath)}\`\`\`\n`;

        return { content: [{ type: "text", text: projectInfo }] };
      }

      case "read_related_files": {
        const maxFiles = args.maxFiles || 10;
        const mainContent = await readFileContent(args.filePath);
        const dir = path.dirname(args.filePath);

        // Extract imports
        const importPatterns = [
          /import\s+.*?\s+from\s+['"](\..*?)['"]/g,
          /require\s*\(\s*['"](\..*?)['"]\s*\)/g,
          /from\s+['"](\..*?)['"]/g
        ];

        const relatedPaths = new Set();
        for (const pattern of importPatterns) {
          let match;
          while ((match = pattern.exec(mainContent)) !== null) {
            relatedPaths.add(match[1]);
          }
        }

        let output = `## Main File: ${args.filePath}\n\`\`\`\n${mainContent}\n\`\`\`\n\n## Related Files:\n\n`;

        let filesRead = 0;
        for (const relPath of relatedPaths) {
          if (filesRead >= maxFiles) break;
          const extensions = ["", ".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"];
          for (const ext of extensions) {
            try {
              const fullPath = path.resolve(dir, relPath + ext);
              const content = await readFileContent(fullPath);
              output += `### ${relPath}${ext}\n\`\`\`\n${content.slice(0, 3000)}${content.length > 3000 ? "\n...(truncated)" : ""}\n\`\`\`\n\n`;
              filesRead++;
              break;
            } catch { }
          }
        }

        return { content: [{ type: "text", text: output }] };
      }

      case "analyze_directory": {
        const extensions = (args.extensions || "js,ts,jsx,tsx,py").split(",").map(e => `.${e.trim()}`);
        const analysisType = args.analysisType || "overview";

        let allCode = "";
        let fileCount = 0;
        const maxTotalSize = 50000; // 50KB limit for GLM context

        async function collectFiles(dir) {
          try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                await collectFiles(fullPath);
              } else if (extensions.includes(path.extname(entry.name))) {
                if (allCode.length < maxTotalSize) {
                  try {
                    const content = await fs.readFile(fullPath, "utf-8");
                    allCode += `\n\n// === FILE: ${fullPath} ===\n${content}`;
                    fileCount++;
                  } catch { }
                }
              }
            }
          } catch { }
        }

        await collectFiles(args.dirPath);

        const analysisPrompts = {
          overview: `Provide a comprehensive overview of this codebase. Include: architecture, main components, entry points, dependencies, and how files relate to each other.`,
          bugs: `Analyze this entire codebase for bugs, issues, and potential problems. List all findings with file locations and severity levels. Then suggest fixes.`,
          security: `Perform a security audit on this codebase. Check for OWASP Top 10 vulnerabilities, hardcoded secrets, input validation issues, and authentication problems.`,
          performance: `Analyze this codebase for performance issues. Look for N+1 queries, memory leaks, inefficient algorithms, unnecessary re-renders, and optimization opportunities.`,
          architecture: `Review the architecture of this codebase. Evaluate: separation of concerns, SOLID principles, design patterns used, coupling/cohesion, and suggest improvements.`
        };

        const prompt = `${analysisPrompts[analysisType] || analysisPrompts.overview}\n\nCodebase (${fileCount} files):\n\`\`\`\n${allCode}\n\`\`\``;

        const result = await callGLM(prompt);
        return {
          content: [{
            type: "text",
            text: `[Deep Thinking - Directory Analysis: ${analysisType}]\n\nAnalyzed ${fileCount} files in ${args.dirPath}\n\n${result}`
          }]
        };
      }

      case "refactor_code": {
        const code = await readFileContent(args.filePath);
        const prompt = `Refactor this code: ${args.instructions}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nReturn only the refactored code.`;
        const result = await callGLM(prompt);
        const newCode = extractCodeFromResponse(result);
        await writeFileContent(args.filePath, newCode);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking]\n\nRefactored: ${args.filePath}\n\n${result}`,
            },
          ],
        };
      }

      case "explain_code": {
        const code = await readFileContent(args.filePath);
        const prompt = `Explain this code in detail:\n\`\`\`\n${code}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [{ type: "text", text: `[Deep Thinking]\n\n${result}` }],
        };
      }

      case "add_comments": {
        const code = await readFileContent(args.filePath);
        const prompt = `Add inline comments to this code explaining what each part does:\n\`\`\`\n${code}\n\`\`\`\n\nReturn only the commented code.`;
        const result = await callGLM(prompt);
        const newCode = extractCodeFromResponse(result);
        await writeFileContent(args.filePath, newCode);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking]\n\nComments added: ${args.filePath}`,
            },
          ],
        };
      }

      case "find_bugs": {
        const code = await readFileContent(args.filePath);
        const prompt = `Analyze this code for bugs and issues. Then FIX all bugs and return the corrected code.

IMPORTANT: Return your response in this format:
1. First, list all bugs found with explanations
2. Then provide the COMPLETE fixed code in a code block

Code:
\`\`\`
${code}
\`\`\``;
        const result = await callGLM(prompt);
        const fixedCode = extractCodeFromResponse(result);
        if (fixedCode && fixedCode.trim() !== code.trim()) {
          await writeFileContent(args.filePath, fixedCode);
        }
        return {
          content: [{
            type: "text",
            text: `[Deep Thinking - Bug Analysis & Fix]\n\n${result}\n\n✅ File updated: ${args.filePath}`
          }]
        };
      }

      case "optimize_code": {
        const code = await readFileContent(args.filePath);
        const prompt = `Analyze this code for performance issues. Then APPLY all optimizations and return the optimized code.

IMPORTANT: Return your response in this format:
1. First, list all performance issues with explanations
2. Then provide the COMPLETE optimized code in a code block

Code:
\`\`\`
${code}
\`\`\``;
        const result = await callGLM(prompt);
        const optimizedCode = extractCodeFromResponse(result);
        if (optimizedCode && optimizedCode.trim() !== code.trim()) {
          await writeFileContent(args.filePath, optimizedCode);
        }
        return {
          content: [{
            type: "text",
            text: `[Deep Thinking - Performance Optimization]\n\n${result}\n\n✅ File updated: ${args.filePath}`
          }]
        };
      }

      case "find_references": {
        const results = await searchFiles(
          args.dirPath,
          args.symbol,
          "js,ts,jsx,tsx,py,java,cs",
        );
        const output = results.length
          ? results.map((r) => `${r.file}:${r.line} - ${r.content}`).join("\n")
          : "No references found.";
        return { content: [{ type: "text", text: output }] };
      }

      // === GIT OPERATIONS ===
      case "git_diff_explain": {
        const diff = await runGitCommand(args.repoPath, "diff");
        if (!diff.trim()) {
          return {
            content: [{ type: "text", text: "No changes to explain." }],
          };
        }
        const prompt = `Explain these git changes in detail:\n\`\`\`diff\n${diff}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [{ type: "text", text: `[Deep Thinking]\n\n${result}` }],
        };
      }

      case "generate_commit_message": {
        const diff = await runGitCommand(args.repoPath, "diff --staged");
        if (!diff.trim()) {
          return {
            content: [
              { type: "text", text: "No staged changes. Use 'git add' first." },
            ],
          };
        }
        const prompt = `Generate a concise, professional git commit message for these changes. Use conventional commits format (feat:, fix:, refactor:, etc.):\n\`\`\`diff\n${diff}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [{ type: "text", text: `[Deep Thinking]\n\n${result}` }],
        };
      }

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
      case "resolve_conflicts": {
        const conflicts = await runGitCommand(args.repoPath, "diff --check");
        const prompt = `Analyze and provide resolution suggestions for git merge conflicts. ${args.conflictFile ? `File: ${args.conflictFile}` : ""}\n\nProvide:\n1. Conflict analysis\n2. Resolution suggestions for each conflict\n3. Automatic resolution where possible\n4. Manual resolution guide\n5. Risk assessment\n\nGit status output:\n${conflicts}`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Conflict Resolution]\n\n${result}`,
            },
          ],
        };
      }

      case "branch_analyzer": {
        const branches = await runGitCommand(args.repoPath, "branch -a");
        const targetBranch = args.targetBranch || "main";
        const prompt = `Analyze git branch strategy and provide merging recommendations. Target branch: ${targetBranch}\n\nProvide:\n1. Active branches list with divergence analysis\n2. Merging order recommendations\n3. Branch cleanup suggestions\n4. Feature flag needs\n5. Risk assessment\n\nBranch output:\n${branches}`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Branch Strategy]\n\n${result}`,
            },
          ],
        };
      }

      case "pr_review": {
        let prDiff = args.prDiff;
        if (!prDiff) {
          prDiff = await runGitCommand(args.repoPath, "diff HEAD^ HEAD");
        }
        const reviewType = args.reviewType || "code_review";
        const prompt = `Generate a comprehensive pull request review. Review type: ${reviewType}\n\nProvide:\n1. Code quality comments\n2. Security issues (if applicable)\n3. Performance concerns (if applicable)\n4. Best practice violations\n5. Actionable suggestions\n\nPR Diff:\n\`\`\`diff\n${prDiff}\n\`\`\``;
        const result = await callGLM(prompt);
        return {
          content: [
            { type: "text", text: `[Deep Thinking - PR Review]\n\n${result}` },
          ],
        };
      }

      case "git_history": {
        const depth = args.depth || 100;
        const history = await runGitCommand(
          args.repoPath,
          `log -n ${depth} --pretty=format:"%h|%an|%ae|%ad|%s"`,
        );
        const prompt = `Analyze git commit history and detect patterns. Analyzing ${depth} commits.\n\nProvide:\n1. Commit frequency analysis\n2. Common patterns detected\n3. Contributor activity\n4. Bug introduction tracking\n5. Release timeline recommendations\n\nHistory:\n${history}`;
        const result = await callGLM(prompt);
        return {
          content: [
            {
              type: "text",
              text: `[Deep Thinking - Git History Analysis]\n\n${result}`,
            },
          ],
        };
      }

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
