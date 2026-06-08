import { callAI, callAIWithThinking, extractCodeFromResponse, writeFileContent } from '../helpers/index.js';
import { buildToolDetectionPrompt, CODE_QUALITY_REQUIREMENTS, PREMIUM_UI_GUIDELINES } from '../prompts/index.js';
import { getFrameworkRules } from '../prompts/frameworks.js';

// AI-powered tool detection
async function autoDetectTool(prompt) {
  const toolPrompt = buildToolDetectionPrompt(prompt);
  const response = await callAI(toolPrompt);

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
            `@DeepThink analyze_query SELECT * FROM users\n` +
            `@DeepThink security_scan ./src/auth.js\n` +
            `@DeepThink generate_dockerfile --framework react\n\n` +
            `[View all tools: https://github.com/YOUR_REPO/tree/main/README.md#tools]`,
        },
      ],
    };
  },

  deep_think_chat: async (args) => {
    const content = await callAI(args.prompt);
    const projectPath = args.projectPath || process.cwd();
    
    // Yanıtta kod bloğu var mı? Varsa otomatik kaydet
    const codeBlocks = content.match(/```(?:\w+)?\n[\s\S]*?```/g);
    if (codeBlocks) {
      // Prompt'tan dosya adı tahmin et, bulamazsa varsayılan kullan
      const extMatch = args.prompt.match(/\.(\w+)\s/); // .html, .js, .py gibi
      const langMatch = content.match(/```(\w+)/);
      const ext = extMatch ? extMatch[1] : (langMatch ? langMatch[1] : 'txt');
      const fileName = `output-${Date.now()}.${ext}`;
      const filePath = `${projectPath}/${fileName}`;
      
      const code = extractCodeFromResponse(content);
      await writeFileContent(filePath, code);
      
      return {
        content: [{ type: "text", text: `[Deep Thinking]\n\n📄 **Dosya kaydedildi:** \`${fileName}\`\n\n${content}` }],
      };
    }
    
    return {
      content: [{ type: "text", text: `[Deep Thinking]\n\n${content}` }],
    };
  },

  deep_think_verbose: async (args) => {
    const result = await callAIWithThinking(args.prompt);
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
    // CoderAgent'in kalite prompt'larını kullan — tıpkı swarm'daki gibi
    const stackRules = args.stack ? getFrameworkRules(
      Array.isArray(args.stack) ? args.stack : args.stack.split(',').map(s => s.trim())
    ) : '';
    
    const coderPrompt = `Persona: Principal Software Engineer
Goal: Implement the requested code with Zero-Bug/Production-Grade quality.

${CODE_QUALITY_REQUIREMENTS}

${PREMIUM_UI_GUIDELINES}

${stackRules}

Task: ${args.prompt}

OUTPUT FORMAT:
Return ONLY the code inside a markdown code block with the appropriate language tag.

\`\`\`language
// your code here
\`\`\``;

    const glmResponse = await callAI(coderPrompt);
    const code = extractCodeFromResponse(glmResponse);
    
    // FilePath yoksa otomatik oluştur
    let filePath = args.filePath;
    if (!filePath) {
      const projectPath = args.projectPath || process.cwd();
      const extMatch = args.prompt.match(/\.(\w+)\b/);
      const langMatch = glmResponse.match(/```(\w+)/);
      const ext = extMatch ? extMatch[1] : (langMatch ? langMatch[1] : 'txt');
      filePath = `${projectPath}/output-${Date.now()}.${ext}`;
    }
    
    await writeFileContent(filePath, code);
    return {
      content: [
        {
          type: "text",
          text: `[Deep Thinking - Coder Enhanced]\n\n📄 **Dosya kaydedildi:** \`${filePath}\`\n\n${glmResponse}`,
        },
      ],
    };
  }
};
