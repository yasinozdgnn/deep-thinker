import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DEEP_THINKING_SYSTEM_PROMPT } from '../prompts/index.js';
import { callZenRaw, callZen } from './providers/zen.js';
import { callGoRaw, callGo } from './providers/go.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

// Provider selection
const AI_PROVIDER = (process.env.AI_PROVIDER || 'zen').toLowerCase();

// Keys
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.GEMİNİ_API_KEY || '').trim();
const ZEN_API_KEY = (process.env.ZEN_API_KEY || '').trim();

// Models
const ZEN_MODEL = process.env.ZEN_MODEL || 'deepseek-v4-flash-free';
const GO_MODEL = process.env.GO_MODEL || 'gemini-2.0-flash';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

// console.error(`[AI] Provider: ${AI_PROVIDER} | Model: ${AI_PROVIDER === 'zen' ? ZEN_MODEL : AI_PROVIDER === 'go' ? GO_MODEL : OPENROUTER_MODEL}`);

// Initialize Gemini SDK if key is available
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

/**
 * Main API call - routes to the configured provider
 */
export async function callAIRaw(prompt, useSystemPrompt = true) {
  const systemPrompt = useSystemPrompt ? DEEP_THINKING_SYSTEM_PROMPT : '';

  switch (AI_PROVIDER) {
    case 'zen': {
      if (!ZEN_API_KEY) {
        throw new Error('ZEN_API_KEY is not set! Configure it in .env');
      }
      const model = process.env.ZEN_MODEL || ZEN_MODEL;
      console.error(`[ZEN] Using model: ${model}`);
      return await callZenRaw(prompt, { model, useSystemPrompt, systemPrompt });
    }

    case 'go': {
      if (!ZEN_API_KEY) {
        throw new Error('ZEN_API_KEY is not set (required for GO API via OpenCode Go)');
      }
      const model = process.env.GO_MODEL || GO_MODEL;
      console.error(`[GO] Using model: ${model}`);
      return await callGoRaw(prompt, { model, useSystemPrompt, systemPrompt });
    }

    case 'gemini': {
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set!');
      }
      return await callGeminiRaw(prompt, useSystemPrompt);
    }

    case 'openrouter':
    default: {
      if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set!');
      }
      return await callOpenRouterRaw(prompt, useSystemPrompt);
    }
  }
}

/**
 * OpenRouter API implementation
 */
async function callOpenRouterRaw(prompt, useSystemPrompt = true) {
  const { default: axios } = await import('axios');
  const messages = [];
  if (useSystemPrompt) {
    messages.push({ role: 'system', content: DEEP_THINKING_SYSTEM_PROMPT });
  }
  messages.push({ role: 'user', content: prompt });

  const safePrompt = prompt || '';
  console.error(`[OpenRouter] Sending request... (Prompt length: ${safePrompt.length})`);
  const startTime = Date.now();
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        { model: OPENROUTER_MODEL, messages, reasoning: { enabled: true } },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'X-Title': 'Deep Thinker MCP',
            'HTTP-Referer': 'https://github.com/yasinozdgnn/deep-thinker'
          },
          timeout: 0
        }
      );
      console.error(`[OpenRouter] Response received in ${(Date.now() - startTime) / 1000}s`);
      return response.data;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      let shouldRetry = false;
      let errorType = 'Unknown Error';

      if (error.response) {
        if (error.response.status >= 500 && error.response.status < 600) {
          shouldRetry = true;
          errorType = `Server Error (${error.response.status})`;
        } else {
          errorType = `Client Error (${error.response.status})`;
        }
      } else {
        errorType = error.message;
      }

      console.error(`🔴 OpenRouter Attempt ${attempt}/${MAX_RETRIES} Failed (${errorType}) after ${duration}s`);

      if (shouldRetry && attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      throw error;
    }
  }
}

/**
 * Direct Google Gemini API implementation
 */
async function callGeminiRaw(prompt, useSystemPrompt = true) {
  if (!genAI) {
    throw new Error('Google Generative AI not initialized. Check GEMINI_API_KEY.');
  }

  console.error(`[Gemini] Sending request...`);
  const startTime = Date.now();

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemma-4-31b-it',
    systemInstruction: useSystemPrompt ? DEEP_THINKING_SYSTEM_PROMPT : undefined
  });

  const safePrompt = (prompt && typeof prompt === 'string' && prompt.trim().length > 0) 
    ? prompt : "Hello (Empty prompt received)";

  const result = await model.generateContent(safePrompt);
  const response = await result.response;
  const text = response.text();

  console.error(`[Gemini] Response received in ${(Date.now() - startTime) / 1000}s`);

  return {
    choices: [{
      message: { content: text, role: 'assistant' }
    }]
  };
}

/**
 * Simple text response
 */
export async function callAI(prompt) {
  const data = await callAIRaw(prompt);
  return data.choices[0].message.content;
}

/**
 * Response with thinking/reasoning
 */
export async function callAIWithThinking(prompt) {
  const data = await callAIRaw(prompt);
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
    output += (typeof thinking === 'string') ? thinking : JSON.stringify(thinking);
    output += '\n\n</details>\n\n---\n\n';
  }
  output += '## Response\n\n';
  output += content;

  return { thinking, content, formatted: output };
}

/**
 * Streaming response
 */
export async function callAIStreaming(prompt, onChunk, useSystemPrompt = true) {
  if (AI_PROVIDER === 'gemini') {
    return await callGeminiStreaming(prompt, onChunk, useSystemPrompt);
  }

  if (AI_PROVIDER === 'zen') {
    return await callZenStreaming(prompt, onChunk, useSystemPrompt);
  }

  // Default: OpenRouter streaming
  return await callOpenRouterStreaming(prompt, onChunk, useSystemPrompt);
}

async function callOpenRouterStreaming(prompt, onChunk, useSystemPrompt = true) {
  const { default: axios } = await import('axios');
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set!');
  }

  const messages = [];
  if (useSystemPrompt) messages.push({ role: 'system', content: DEEP_THINKING_SYSTEM_PROMPT });
  messages.push({ role: 'user', content: prompt });

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    { model: OPENROUTER_MODEL, messages, stream: true, reasoning: { enabled: true } },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'X-Title': 'Deep Thinker MCP'
      },
      responseType: 'stream',
      timeout: 0
    }
  );

  let fullReasoning = '';
  let fullContent = '';

  return new Promise((resolve, reject) => {
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        if (line.includes('data: [DONE]')) return;
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            const delta = data.choices[0].delta;
            const reasoning = delta.reasoning_content || delta.reasoning || delta.thinking || delta.thought || '';
            const content = delta.content || '';

            if (reasoning) {
              fullReasoning += reasoning;
              onChunk({ type: 'reasoning', chunk: reasoning });
            }
            if (content) {
              fullContent += content;
              onChunk({ type: 'content', chunk: content });
            }
          } catch (e) {}
        }
      }
    });

    response.data.on('end', () => resolve({ thinking: fullReasoning, content: fullContent }));
    response.data.on('error', (err) => reject(err));
  });
}

async function callZenStreaming(prompt, onChunk, useSystemPrompt = true) {
  const { default: axios } = await import('axios');
  const messages = [];
  if (useSystemPrompt) messages.push({ role: 'system', content: DEEP_THINKING_SYSTEM_PROMPT });
  messages.push({ role: 'user', content: prompt });

  const response = await axios.post(
    `https://opencode.ai/zen/v1/chat/completions`,
    { model: ZEN_MODEL, messages, stream: true },
    {
      headers: {
        Authorization: `Bearer ${ZEN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 0
    }
  );

  let fullContent = '';
  return new Promise((resolve, reject) => {
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        if (line.includes('data: [DONE]')) return;
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            const content = data.choices[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              onChunk({ type: 'content', chunk: content });
            }
          } catch (e) {}
        }
      }
    });
    response.data.on('end', () => resolve({ thinking: '', content: fullContent }));
    response.data.on('error', (err) => reject(err));
  });
}

async function callGeminiStreaming(prompt, onChunk, useSystemPrompt = true) {
  if (!genAI) throw new Error('Google Generative AI not initialized');
  
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemma-4-31b-it',
    systemInstruction: useSystemPrompt ? DEEP_THINKING_SYSTEM_PROMPT : undefined
  });

  const result = await model.generateContentStream(prompt);
  let fullContent = '';

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullContent += chunkText;
    onChunk({ type: 'content', chunk: chunkText });
  }

  return { thinking: '', content: fullContent };
}

export function extractCodeFromResponse(response) {
  if (!response || typeof response !== 'string') return response || '';
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
  const matches = [...response.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    return matches.map((m) => m[1]).join('\n\n');
  }
  return response;
}
