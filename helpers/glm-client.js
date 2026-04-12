import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DEEP_THINKING_SYSTEM_PROMPT } from '../prompts/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env relative to this file's location (one level up from helpers/)
dotenv.config({ path: path.join(__dirname, '../.env') });

const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.GEMİNİ_API_KEY || '').trim();
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = GEMINI_API_KEY ? 'gemma-4-31b-it' : 'openrouter/free';

// Initialize Gemini if key is available
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export async function callGLMRaw(prompt, useSystemPrompt = true) {
  if (GEMINI_API_KEY) {
    return await callGeminiRaw(prompt, useSystemPrompt);
  }

  if (!OPENROUTER_API_KEY) {
    throw new Error('Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is set!');
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
          timeout: 0 // Deep reasoning can take some time
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
        if (error.response.status >= 500 && error.response.status < 600) {
          shouldRetry = true;
          errorType = `Server Error (${error.response.status})`;
        } else {
          errorType = `Client Error (${error.response.status}) - ${JSON.stringify(error.response.data)}`;
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

async function callGeminiRaw(prompt, useSystemPrompt = true) {
  console.error(`[Gemini] Sending request to ${MODEL}...`);
  const startTime = Date.now();
  
  const model = genAI.getGenerativeModel({ 
    model: MODEL,
    systemInstruction: useSystemPrompt ? DEEP_THINKING_SYSTEM_PROMPT : undefined
  });

  const safePrompt = (prompt && typeof prompt === 'string' && prompt.trim().length > 0) ? prompt : "Hello (Empty prompt received)";
  if (!prompt) {
    console.error(`[Gemini] ⚠️ Warning: Received empty prompt, using fallback.`);
  }

  const result = await model.generateContent(safePrompt);
  const response = await result.response;
  const text = response.text();
  
  console.error(`[Gemini] Response received in ${(Date.now() - startTime) / 1000}s`);

  // Map to OpenAI-like structure for internal compatibility
  return {
    choices: [{
      message: {
        content: text,
        role: 'assistant'
      }
    }]
  };
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
    message.thinking || null;

  const content = message.content;

  let output = '';

  if (thinking) {
    output += '## Thinking Process\n\n';
    output += '<details>\n<summary>Click to expand thinking process...</summary>\n\n';
    output += (typeof thinking === 'string') ? thinking : JSON.stringify(thinking);
    output += '\n\n</details>\n\n';
    output += '---\n\n';
  }

  output += '## Response\n\n';
  output += content;

  return { thinking, content, formatted: output };
}

export async function callGLMStreaming(prompt, onChunk, useSystemPrompt = true) {
  if (GEMINI_API_KEY) {
    return await callGeminiStreaming(prompt, onChunk, useSystemPrompt);
  }

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set!');
  }

  const messages = [];
  if (useSystemPrompt) messages.push({ role: 'system', content: DEEP_THINKING_SYSTEM_PROMPT });
  messages.push({ role: 'user', content: prompt });

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: MODEL,
        messages,
        stream: true,
        reasoning: { enabled: true }
      },
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
  } catch (error) {
    throw error;
  }
}

async function callGeminiStreaming(prompt, onChunk, useSystemPrompt = true) {
  const model = genAI.getGenerativeModel({ 
    model: MODEL,
    systemInstruction: useSystemPrompt ? DEEP_THINKING_SYSTEM_PROMPT : undefined
  });

  try {
    const result = await model.generateContentStream(prompt);
    let fullContent = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullContent += chunkText;
      onChunk({ type: 'content', chunk: chunkText });
    }

    return { thinking: '', content: fullContent };
  } catch (error) {
    console.error('🔴 Gemini Streaming Error:', error);
    throw error;
  }
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
