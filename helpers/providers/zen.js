/**
 * ZEN API Provider
 * Base URL: https://opencode.ai/zen/v1
 */
export async function callZenRaw(prompt, options = {}) {
  // Load .env if not already loaded
  if (!process.env.ZEN_API_KEY) {
    const { default: dotenv } = await import('dotenv');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });
  }

  const { 
    model = process.env.ZEN_MODEL || 'deepseek-v4-flash-free',
    useSystemPrompt = true,
    systemPrompt = ''
  } = options;

  const ZEN_API_KEY = (process.env.ZEN_API_KEY || '').trim();
  if (!ZEN_API_KEY) {
    throw new Error('ZEN_API_KEY environment variable is not set!');
  }

  const BASE_URL = process.env.ZEN_API_URL || 'https://opencode.ai/zen/v1';
  const messages = [];

  if (useSystemPrompt && systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  console.error(`[ZEN API] Sending request to ${model}... (Prompt length: ${(prompt || '').length})`);

  const { default: axios } = await import('axios');
  const startTime = Date.now();
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${BASE_URL}/chat/completions`,
        { model, messages, max_tokens: options.maxTokens || undefined },
        {
          headers: {
            'Authorization': `Bearer ${ZEN_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || parseInt(process.env.ZEN_API_TIMEOUT || '300000')
        }
      );

      console.error(`[ZEN API] Response received in ${(Date.now() - startTime) / 1000}s`);
      return response.data;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      let errorType = 'Unknown Error';
      let shouldRetry = false;

      if (error.response) {
        if (error.response.status >= 500 && error.response.status < 600) {
          shouldRetry = true;
          errorType = `Server Error (${error.response.status})`;
        } else {
          errorType = `Client Error (${error.response.status}) - ${JSON.stringify(error.response.data).substring(0, 200)}`;
        }
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        // Timeout da retry yapılsın — free API bazen yavaş olabiliyor
        shouldRetry = attempt < MAX_RETRIES;
        errorType = error.message;
      } else {
        errorType = error.message;
      }

      console.error(`🔴 ZEN API Attempt ${attempt}/${MAX_RETRIES} Failed (${errorType}) after ${duration}s`);

      if (shouldRetry && attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      throw error;
    }
  }
}

export async function callZen(prompt, options = {}) {
  const data = await callZenRaw(prompt, options);
  return data.choices[0].message.content;
}
