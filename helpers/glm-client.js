import axios from 'axios';
import { DEEP_THINKING_SYSTEM_PROMPT } from '../prompts/index.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openrouter/free';

export async function callGLMRaw(prompt, useSystemPrompt = true) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set!');
  }

  const messages = [];

  if (useSystemPrompt) {
    messages.push({ role: 'system', content: DEEP_THINKING_SYSTEM_PROMPT });
  }

  messages.push({ role: 'user', content: prompt });

  const safePrompt = prompt || '';
  console.error(`[OpenRouter] Sending request to ${MODEL}... (Prompt length: ${safePrompt.length})`);
  const startTime = Date.now();
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let payload;
    try {
      payload = {
        model: MODEL,
        messages,
        reasoning: {
          enabled: true
        }
      };

      const response = await axios.post(
        OPENROUTER_API_URL,
        payload,
        {
          headers: { 
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'X-Title': 'Deep Thinker MCP',
            'HTTP-Referer': 'https://github.com/yasinozdgnn/deep-thinker'
          },
          timeout: 0 // No timeout (Deep Thinking can take a long time)
        },
      );

      console.error(`[OpenRouter] Response received in ${(Date.now() - startTime) / 1000}s`);
      return response.data;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      // Determine if we should retry
      let shouldRetry = false;
      let errorType = 'Unknown Error';

      if (error.response) {
        // Log detailed payload for 400 errors
        if (error.response.status === 400) {
          console.error(`🔴 OpenRouter 400 Bad Request. Payload causing error:`, JSON.stringify(payload, null, 2));
        }

        // Retry on Server Errors (5xx)
        if (error.response.status >= 500 && error.response.status < 600) {
          shouldRetry = true;
          errorType = `Server Error (${error.response.status})`;
        } else {
          errorType = `Client Error (${error.response.status}) - ${JSON.stringify(error.response.data)}`;
        }
      } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        shouldRetry = true;
        errorType = 'Timeout';
      } else if (error.code === 'ECONNRESET') {
        shouldRetry = true;
        errorType = 'Connection Reset';
      } else {
        errorType = error.message;
      }

      console.error(`🔴 OpenRouter Attempt ${attempt}/${MAX_RETRIES} Failed (${errorType}) after ${duration}s`);

      if (shouldRetry && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
        console.error(`🔄 Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // If we're here, we exhausted retries or it's non-retryable
      if (error.response) {
        console.error('🔴 OpenRouter API Final Fail:', {
          status: error.response.status,
          data: error.response.data,
          requestId: error.response.headers['x-request-id']
        });
        throw new Error(`OpenRouter API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
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
    (Array.isArray(message.choices?.[0]?.message?.reasoning) 
      ? message.choices[0].message.reasoning.map(r => r.text).join('') 
      : (message.reasoning?.text || null));

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
