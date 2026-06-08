/**
 * GO (OpenCode Go) API Provider
 * Base URL: https://opencode.ai/zen/go/v1
 * 
 * OpenCode Go provides access to paid/pro models:
 * - minimax-m3, minimax-m2.7, minimax-m2.5, minimax-m3-free (ended)
 * - kimi-k2.6, kimi-k2.5
 * - glm-5.1, glm-5
 * - deepseek-v4-pro, deepseek-v4-flash
 * - qwen3.7-max, qwen3.7-plus, qwen3.6-plus, qwen3.5-plus
 * - mimo-v2-pro, mimo-v2-omni, mimo-v2.5-pro, mimo-v2.5
 * - hy3-preview
 */
export async function callGoRaw(prompt, options = {}) {
  // Load .env if not already loaded
  if (!process.env.ZEN_API_KEY) {
    const { default: dotenv } = await import('dotenv');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });
  }

  const {
    model = process.env.GO_MODEL || 'minimax-m3',
    useSystemPrompt = true,
    systemPrompt = '',
    maxTokens = process.env.GO_MAX_TOKENS ? parseInt(process.env.GO_MAX_TOKENS) : 4096,
    temperature = process.env.GO_TEMPERATURE ? parseFloat(process.env.GO_TEMPERATURE) : 0.7,
    timeout = parseInt(process.env.ZEN_API_TIMEOUT || '300000')
  } = options;

  const ZEN_API_KEY = (process.env.ZEN_API_KEY || '').trim();
  if (!ZEN_API_KEY) {
    throw new Error('ZEN_API_KEY environment variable is not set! (required for GO API)');
  }

  const { default: axios } = await import('axios');
  const GO_BASE = process.env.GO_API_BASE || 'https://opencode.ai/zen/go/v1';
  const GO_MODEL = process.env.GO_MODEL || model;

  const messages = [];
  if (useSystemPrompt && systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const safePrompt = (prompt || '').substring(0, 100);
  console.error(`[GO API] Sending request to ${GO_MODEL}... (Prompt length: ${(prompt || '').length})`);
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${GO_BASE}/chat/completions`,
      {
        model: GO_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature
      },
      {
        headers: {
          Authorization: `Bearer ${ZEN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout
      }
    );
    console.error(`[GO API] Response received in ${(Date.now() - startTime) / 1000}s`);
    return response.data;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    if (error.response) {
      console.error(`🔴 GO API Error (${error.response.status}) after ${duration}s:`, 
        JSON.stringify(error.response.data || error.message).substring(0, 200));
      throw new Error(`GO API: ${error.response.status} - ${JSON.stringify(error.response.data || error.message)}`);
    }
    throw error;
  }
}

/**
 * Simplified GO call - returns just the text
 */
export async function callGo(prompt, options = {}) {
  const data = await callGoRaw(prompt, options);
  return data.choices[0]?.message?.content || '';
}
