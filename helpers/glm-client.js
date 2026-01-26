import axios from 'axios';
import { DEEP_THINKING_SYSTEM_PROMPT } from '../prompts/index.js';

const GLM_API_KEY = process.env.GLM_API_KEY;
const GLM_API_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';
const GLM_MODEL = 'glm-4.7';

export async function callGLMRaw(prompt, useSystemPrompt = true) {
  if (!GLM_API_KEY) {
    throw new Error('GLM_API_KEY environment variable is not set!');
  }

  const messages = [];

  if (useSystemPrompt) {
    messages.push({ role: 'system', content: DEEP_THINKING_SYSTEM_PROMPT });
  }

  messages.push({ role: 'user', content: prompt });

  console.error(`[GLM] Sending request to ${GLM_MODEL}... (Prompt length: ${prompt.length})`);
  const startTime = Date.now();

  try {
    const payload = {
      model: GLM_MODEL,
      messages,
      // Note: In GLM-4.7, Thinking is activated by default on coding endpoints.
      // Explicitly sending "thinking": { "type": "enabled" } might cause 400 errors 
      // if the endpoint is already in thinking mode.
    };

    const response = await axios.post(
      GLM_API_URL,
      payload,
      {
        headers: { Authorization: `Bearer ${GLM_API_KEY}` },
        timeout: 0 // No timeout (Deep Thinking can take a long time)
      },
    );

    console.error(`[GLM] Response received in ${(Date.now() - startTime) / 1000}s`);
    return response.data;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    if (error.response) {
      console.error(`🔴 GLM API Error (${error.response.status}) after ${duration}s:`, {
        data: error.response.data,
        requestId: error.response.headers['x-request-id']
      });
      throw new Error(`GLM API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
    } else if (error.code === 'ECONNABORTED') {
      console.error(`🔴 GLM API Timeout after ${duration}s`);
      throw new Error(`GLM API Timeout after ${duration}s`);
    }
    console.error(`🔴 GLM Network Error after ${duration}s: ${error.message}`);
    throw error;
  }
}

export async function callGLM(prompt) {
  const data = await callGLMRaw(prompt);
  return data.choices[0].message.content;
}

export async function callGLMWithThinking(prompt) {
  const data = await callGLMRaw(prompt);
  const message = data.choices[0].message;

  const thinking =
    message.reasoning_content ||
    message.thinking_content ||
    message.reasoning ||
    message.thinking ||
    null;

  const content = message.content;

  let output = '';

  if (thinking) {
    output += '## Thinking Process\n\n';
    output += '<details>\n<summary>Click to expand thinking process...</summary>\n\n';
    output += thinking;
    output += '\n\n</details>\n\n';
    output += '---\n\n';
  }

  output += '## Response\n\n';
  output += content;

  return { thinking, content, formatted: output };
}

export function extractCodeFromResponse(response) {
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
  const matches = [...response.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    return matches.map((m) => m[1]).join('\n\n');
  }
  return response;
}
