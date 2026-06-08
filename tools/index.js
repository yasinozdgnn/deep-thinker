import { coreTools } from './core.js';
import { fileOpsTools } from './file-ops.js';
import { codeAnalysisTools } from './code-analysis.js';
import { gitOpsTools } from './git-ops.js';
import { testingTools } from './testing.js';
import { databaseTools } from './database.js';
import { devopsTools } from './devops.js';
import { securityTools } from './security.js';
import { apiTools } from './api.js';
import { projectTools } from './project.js';
import { agentTools } from './agent.js';
import { architectTools } from './architect.js';
import { opencodeTools } from './opencode.js';

const executionTools = [
  {
    name: "run_in_sandbox",
    description: "Safely execute a code snippet in an isolated sandbox environment. Supported languages: javascript, python, bash, typescript, php, go (golang).",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The source code to execute"
        },
        language: {
          type: "string",
          description: "Programming language (javascript, python, bash, typescript)",
          default: "javascript"
        },
        dependencies: {
          type: "array",
          items: { type: "string" },
          description: "List of dependencies (experimental)"
        }
      },
      required: ["code"]
    }
  }
];

const swarmTools = [
  {
    name: "delegate_to_swarm",
    description: "Delegate a complex task to a swarm of specialized AI agents (Architect, Coder, QA). Best for full feature implementation.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The complex task description"
        },
        projectPath: {
          type: "string",
          description: "Root path of the project (optional)"
        }
      },
      required: ["task"]
    }
  }
];

const memoryTools = [
  {
    name: "index_codebase",
    description: "Scan the project and build a semantic memory index (summaries + tags) for the codebase. Run this periodically or after major changes.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Root path of the project (optional)"
        }
      }
    }
  },
  {
    name: "semantic_search",
    description: "Search the codebase using natural language (e.g., 'find the authentication logic' or 'where are API keys validated?')",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The natural language query"
        },
        projectPath: {
          type: "string",
          description: "Root path of the project (optional)"
        }
      },
      required: ["query"]
    }
  }
];

const watcherTools = [
  {
    name: "start_watcher",
    description: "Start the Proactive File Watcher. It will monitor the project for changes and trigger auto-actions (like syntax checks) in the background.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Root path of the project (optional)"
        }
      }
    }
  },
  {
    name: "stop_watcher",
    description: "Stop the Proactive File Watcher.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "watcher_status",
    description: "Check if the Proactive Watcher is currently running.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

export const tools = [
  ...coreTools,
  ...fileOpsTools,
  ...codeAnalysisTools,
  ...gitOpsTools,
  ...testingTools,
  ...databaseTools,
  ...devopsTools,
  ...securityTools,
  ...apiTools,
  ...projectTools,
  ...agentTools,
  ...executionTools,
  ...swarmTools,
  ...memoryTools,
  ...watcherTools,
  ...architectTools,
  ...opencodeTools
];

export {
  coreTools,
  fileOpsTools,
  codeAnalysisTools,
  gitOpsTools,
  testingTools,
  databaseTools,
  devopsTools,
  securityTools,
  apiTools,
  projectTools,
  agentTools,
  executionTools,
  swarmTools,
  memoryTools,
  watcherTools,
  architectTools,
  opencodeTools
};
