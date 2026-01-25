export const codeAnalysisTools = [
  {
    name: "refactor_code",
    description: "Read code, refactor with Deep Thinking, and save back.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to refactor" },
        instructions: { type: "string", description: "Refactoring instructions" },
      },
      required: ["filePath", "instructions"],
    },
  },
  {
    name: "explain_code",
    description: "Read file and generate detailed explanation.",
    inputSchema: {
      type: "object",
      properties: { filePath: { type: "string", description: "File to explain" } },
      required: ["filePath"],
    },
  },
  {
    name: "add_comments",
    description: "Add inline comments to code.",
    inputSchema: {
      type: "object",
      properties: { filePath: { type: "string", description: "File to add comments" } },
      required: ["filePath"],
    },
  },
  {
    name: "find_bugs",
    description: "Analyze code for potential bugs and issues. Can optionally auto-fix detected bugs.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to analyze" },
        autoFix: { type: "boolean", description: "If true, automatically fix detected bugs and save the file" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "fix_bugs",
    description: "Analyze code for bugs and automatically fix them. Saves the corrected code back to the file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "File to analyze and fix" },
        specificBug: { type: "string", description: "Optional: specific bug description to fix" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "optimize_code",
    description: "Suggest performance optimizations for code.",
    inputSchema: {
      type: "object",
      properties: { filePath: { type: "string", description: "File to optimize" } },
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
];
