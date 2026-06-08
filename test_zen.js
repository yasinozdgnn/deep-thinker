import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const API_KEY = (process.env.ZEN_API_KEY || '').trim();
const BASE_URL = (process.env.ZEN_API_BASE_URL || 'https://opencode.ai/zen/v1').replace(/\/+$/, '');

async function testModel(model) {
  try {
    const response = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: '1+1=? Just the number.' }],
        max_tokens: 10
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        timeout: 15000
      }
    );
    console.log(`✅ ${model}: ${response.data.choices[0].message.content}`);
    return true;
  } catch (error) {
    const status = error.response?.status || '???';
    const msg = error.response?.data?.error?.message || error.message;
    console.log(`❌ ${model}: HTTP ${status} - ${msg.substring(0, 100)}`);
    return false;
  }
}

const models = [
  'gpt-4o-mini',
  'gpt-4o-mini-free',
  'gemini-2.0-flash',
  'gemini-2.0-flash-free',
  'claude-3-haiku',
  'deepseek-chat',
  'deepseek-v3',
  'meta-llama-3.1-8b',
  'mistral-7b',
  'qwen-2.5-7b',
  'free',
  'minimax-m3-free',
];

(async () => {
  if (!API_KEY) {
    console.log('❌ ZEN_API_KEY bulunamadı!');
    process.exit(1);
  }
  console.log('Testing models on OpenCode Zen API...\n');
  for (const model of models) {
    await testModel(model);
    await new Promise(r => setTimeout(r, 800));
  }
})();
