import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

const ZEN_API_KEY = (process.env.ZEN_API_KEY || '').trim();
const ZEN_BASE_URL = (process.env.ZEN_API_BASE_URL || 'https://opencode.ai/zen/v1').replace(/\/+$/, '');
const GO_BASE_URL = (process.env.GO_API_BASE_URL || 'https://opencode.ai/zen/go/v1').replace(/\/+$/, '');

const DEFAULT_MODEL = (process.env.ZEN_MODEL || 'deepseek-v4-flash-free').trim();

/**
 * Call OpenCode Zen API (OpenAI-compatible)
 */
async function callOpenCodeAPI(task, options = {}) {
  const {
    model = DEFAULT_MODEL,
    baseUrl = ZEN_BASE_URL,
    systemPrompt = '',
    maxTokens = 2048
  } = options;

  if (!ZEN_API_KEY) {
    throw new Error('ZEN_API_KEY is not set! OpenCode API requires a valid API key.');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: task });

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages,
        max_tokens: maxTokens
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ZEN_API_KEY}`
        },
        timeout: 300000 // 5 min
      }
    );

    return {
      success: true,
      output: response.data.choices[0].message.content,
      model: response.data.model || model
    };
  } catch (error) {
    const status = error.response?.status || '';
    const msg = error.response?.data?.error?.message || error.message;
    return {
      success: false,
      output: msg,
      error: `OpenCode API Error (${status}): ${msg}`
    };
  }
}

export const opencodeHandlers = {
  /**
   * Run a coding task via OpenCode Zen API
   */
  opencode_run: async (args) => {
    const { task, projectPath, model, systemPrompt, files } = args;

    if (!task) {
      return {
        content: [{ type: "text", text: "❌ Task (görev) parametresi zorunludur." }],
        isError: true
      };
    }

    // Build context from project path and files
    let contextPrompt = task;
    if (projectPath) {
      contextPrompt = `Project path: ${projectPath}\n\n${task}`;
    }
    if (files && files.length > 0) {
      const fileContext = Array.isArray(files) ? files.join(', ') : files;
      contextPrompt = `Context files: ${fileContext}\n\n${contextPrompt}`;
    }

    const result = await callOpenCodeAPI(contextPrompt, {
      model: model || DEFAULT_MODEL,
      baseUrl: ZEN_BASE_URL,
      systemPrompt: systemPrompt || ''
    });

    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `🤖 **OpenCode Execution Result**\n\n✅ Task completed successfully.\n**Model:** ${result.model}\n\n**Output:**\n\`\`\`\n${result.output || '(no output)'}\n\`\`\``
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `🤖 **OpenCode Execution Result**\n\n❌ Task failed.\n\n**Error:**\n\`\`\`\n${result.error || result.output || '(unknown error)'}\n\`\`\``
        }],
        isError: true
      };
    }
  },

  /**
   * Run a coding task with thinking/reasoning visible
   */
  opencode_run_with_thinking: async (args) => {
    const { task, projectPath, model, systemPrompt, files } = args;

    if (!task) {
      return {
        content: [{ type: "text", text: "❌ Task (görev) parametresi zorunludur." }],
        isError: true
      };
    }

    let contextPrompt = task;
    if (projectPath) {
      contextPrompt = `Project path: ${projectPath}\n\n${task}`;
    }
    if (files && files.length > 0) {
      const fileContext = Array.isArray(files) ? files.join(', ') : files;
      contextPrompt = `Context files: ${fileContext}\n\n${contextPrompt}`;
    }

    // For thinking mode, add instruction to show reasoning
    contextPrompt = `Please show your reasoning step by step, then provide the final answer.\n\n${contextPrompt}`;

    const result = await callOpenCodeAPI(contextPrompt, {
      model: model || DEFAULT_MODEL,
      baseUrl: ZEN_BASE_URL,
      systemPrompt: systemPrompt || 'You are an expert coding assistant. Show your reasoning clearly.'
    });

    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `🤖 **OpenCode Execution (With Thinking)**\n\n✅ Task completed successfully.\n**Model:** ${result.model}\n\n**Output:**\n\`\`\`\n${result.output || '(no output)'}\n\`\`\``
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `🤖 **OpenCode Execution (With Thinking)**\n\n❌ Task failed.\n\n**Error:**\n\`\`\`\n${result.error || result.output || '(unknown error)'}\n\`\`\``
        }],
        isError: true
      };
    }
  },

  /**
   * Run a Go programming task via OpenCode Go API endpoint
   */
  opencode_go_run: async (args) => {
    const { task, projectPath, model, systemPrompt, files } = args;

    if (!task) {
      return {
        content: [{ type: "text", text: "❌ Task (görev) parametresi zorunludur." }],
        isError: true
      };
    }

    let contextPrompt = `[Go Programming Task]\n${task}`;
    if (projectPath) {
      contextPrompt = `Project path: ${projectPath}\n\n${contextPrompt}`;
    }
    if (files && files.length > 0) {
      const fileContext = Array.isArray(files) ? files.join(', ') : files;
      contextPrompt = `Context files: ${fileContext}\n\n${contextPrompt}`;
    }

    // Go endpoint uses minimax-m3 by default for code tasks
    const result = await callOpenCodeAPI(contextPrompt, {
      model: model || 'minimax-m3',
      baseUrl: GO_BASE_URL,
      systemPrompt: systemPrompt || 'You are an expert Go (Golang) programmer. Write clean, idiomatic Go code with proper error handling.'
    });

    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `🤖 **OpenCode Go Execution Result**\n\n✅ Go task completed successfully.\n**Model:** ${result.model}\n\n**Output:**\n\`\`\`go\n${result.output || '(no output)'}\n\`\`\``
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `🤖 **OpenCode Go Execution Result**\n\n❌ Task failed.\n\n**Error:**\n\`\`\`\n${result.error || result.output || '(unknown error)'}\n\`\`\``
        }],
        isError: true
      };
    }
  }
};
