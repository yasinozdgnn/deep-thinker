export const opencodeTools = [
  {
    name: "opencode_run",
    description: "Run OpenCode via API as an autonomous coding agent. Delegate complex coding tasks (refactoring, bug fixing, feature implementation, code review) to OpenCode. Uses OpenCode Zen API. Best for tasks that require understanding codebase context or multi-file changes. Works without OpenCode CLI installed.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The task description for OpenCode (e.g., 'Fix the login form validation', 'Add unit tests for utils.js', 'Refactor auth module to use async/await')"
        },
        projectPath: {
          type: "string",
          description: "Project root directory path (default: current working directory)"
        },
        model: {
          type: "string",
          description: "Force a specific Zen API model (e.g., 'deepseek-v4-flash-free', 'nemotron-3-ultra-free')"
        },
        systemPrompt: {
          type: "string",
          description: "Custom system prompt for the agent"
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "File paths to attach as context"
        }
      },
      required: ["task"]
    }
  },
  {
    name: "opencode_run_with_thinking",
    description: "Run OpenCode via API with thinking/reasoning output visible. Same as opencode_run but shows the model's reasoning process. Use for complex debugging or educational tasks.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The task description for OpenCode"
        },
        projectPath: {
          type: "string",
          description: "Project root directory path"
        },
        model: {
          type: "string",
          description: "Force a specific model"
        },
        systemPrompt: {
          type: "string",
          description: "Custom system prompt"
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "File paths to attach as context"
        }
      },
      required: ["task"]
    }
  },
  {
    name: "opencode_go_run",
    description: "Run a Go (Golang) programming task via OpenCode Go API endpoint. Use for Go-specific tasks: writing Go code, debugging Go programs, code review for Go projects, Go module management, Go concurrency/goroutine tasks. Uses minimax-m3 model optimized for code.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The Go programming task (e.g., 'Write a Go HTTP server with middleware', 'Fix goroutine leak in worker pool', 'Review this Go code for race conditions')"
        },
        projectPath: {
          type: "string",
          description: "Project root directory path"
        },
        model: {
          type: "string",
          description: "Force a specific Go API model (e.g., 'minimax-m3', 'deepseek-v4-flash')"
        },
        systemPrompt: {
          type: "string",
          description: "Custom system prompt for Go programming"
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "Go file paths to attach as context"
        }
      },
      required: ["task"]
    }
  }
];
