import { callGLM, callGLMWithThinking, extractCodeFromResponse, writeFileContent } from '../helpers/index.js';
import { buildToolDetectionPrompt } from '../prompts/index.js';

// AI-powered tool detection
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

export const coreHandlers = {
  auto_detect: async (args) => {
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
  },

  deep_think_chat: async (args) => {
    const content = await callGLM(args.prompt);
    return {
      content: [{ type: "text", text: `[Deep Thinking]\n\n${content}` }],
    };
  },

  deep_think_verbose: async (args) => {
    const result = await callGLMWithThinking(args.prompt);
    return {
      content: [
        {
          type: "text",
          text: `[Deep Thinking - Verbose Mode]\n\n${result.formatted}`,
        },
      ],
    };
  },

  deep_think_code: async (args) => {
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
};
