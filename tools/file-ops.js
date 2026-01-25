export const fileOpsTools = [
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
        extensions: { type: "string", description: "File extensions (comma-separated)" },
      },
      required: ["dirPath", "pattern"],
    },
  },
  {
    name: "read_project",
    description: "Read project structure and important files.",
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
    description: "Read a file and all files it imports/references.",
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
    description: "Read and analyze all code files in a directory.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "Directory to analyze" },
        extensions: { type: "string", description: "File extensions to include" },
        analysisType: { type: "string", description: "Type: overview, bugs, security, performance, architecture" },
        autoFix: { type: "boolean", description: "If true, automatically attempts to fix identified issues using specialized tools." },
      },
      required: ["dirPath", "analysisType"],
    },
  },
];
