export const coreTools = [
  {
    name: "auto_detect",
    description: "AI-powered tool selection. Just describe what you want to do, and AI will choose the best tool automatically.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Describe what you want to do (no need to specify tool name)",
        },
      },
      required: ["prompt"],
    },
  },
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
    description: "Deep thinking with visible reasoning process. Shows how the model thinks before answering.",
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
    description: "Generate code with Deep Thinking and save to file. Dosya yolu belirtilmezse otomatik oluşturur.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Code task or request" },
        filePath: { type: "string", description: "Absolute file path to save (optional — auto-generated if omitted)" },
      },
      required: ["prompt"],
    },
  },
];
