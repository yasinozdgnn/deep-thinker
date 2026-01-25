export const agentTools = [
  {
    name: "plan_task",
    description: "Create an execution plan for a complex task.",
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
    description: "Execute a previously created plan step by step.",
    inputSchema: {
      type: "object",
      properties: {
        planId: { type: "string", description: "Plan ID to execute" },
        stepIndex: { type: "number", description: "Start from specific step" }
      },
      required: ["planId"]
    }
  },
  {
    name: "run_workflow",
    description: "Execute a predefined multi-tool workflow.",
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
    description: "Store information in agent memory for future reference.",
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
        topic: { type: "string", description: "What to recall: tools, errors, patterns, project, all" }
      },
      required: ["projectPath", "topic"]
    }
  },
  {
    name: "get_insights",
    description: "Get agent's learned insights and recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project path" },
        topic: { type: "string", description: "Topic: tools, patterns, errors, performance, all" }
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
  {
    name: "decompose_task",
    description: "Decompose a complex task into subtasks with dependency resolution.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Complex task description" },
        projectPath: { type: "string", description: "Project context path" },
        executeImmediately: { type: "boolean", description: "Execute subtasks automatically" },
        maxSubtasks: { type: "number", description: "Maximum number of subtasks" }
      },
      required: ["task"]
    }
  },
  {
    name: "execute_parallel",
    description: "Execute multiple tasks in parallel using mini-agents.",
    inputSchema: {
      type: "object",
      properties: {
        tasks: { type: "string", description: "JSON array of tasks" },
        projectPath: { type: "string", description: "Project context path" },
        maxConcurrency: { type: "number", description: "Maximum parallel agents" },
        continueOnError: { type: "boolean", description: "Continue if some tasks fail" }
      },
      required: ["tasks"]
    }
  },
  {
    name: "get_strategy_suggestion",
    description: "Get AI-learned strategy suggestions for a task type.",
    inputSchema: {
      type: "object",
      properties: {
        taskType: { type: "string", description: "Type of task" },
        projectPath: { type: "string", description: "Project context path" },
        context: { type: "string", description: "Additional context" }
      },
      required: ["taskType", "projectPath"]
    }
  },
  {
    name: "analyze_performance",
    description: "Analyze tool performance and get recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project context path" },
        toolName: { type: "string", description: "Specific tool to analyze" },
        includePatterns: { type: "boolean", description: "Include pattern analysis" },
        includeRecommendations: { type: "boolean", description: "Generate recommendations" }
      },
      required: ["projectPath"]
    }
  }
];
