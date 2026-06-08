import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const KEY = process.env.ZEN_API_KEY || '';
const BASE = (process.env.ZEN_API_BASE_URL || 'https://opencode.ai/zen/v1').replace(/\/+$/, '');

const FREE_MODELS = [
  'deepseek-v4-flash-free',
  'qwen3.6-plus-free', 
  'mimo-v2.5-free',
  'minimax-m3-free',
  'nemotron-3-ultra-free',
  'nemotron-3-super-free'
];

async function testModel(model) {
  try {
    const resp = await axios.post(BASE + '/chat/completions', {
      model,
      messages: [{ role: 'user', content: '1+1=? Sadece sayı yaz.' }],
      max_tokens: 5
    }, {
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      timeout: 20000,
      validateStatus: () => true
    });
    
    if (resp.status === 200) {
      console.log('✅ ' + model + ': ' + resp.data.choices[0].message.content);
      return { ok: true, model };
    } else {
      const msg = resp.data?.error?.message || JSON.stringify(resp.data).substring(0, 120);
      console.log('❌ ' + model + ' (HTTP ' + resp.status + '): ' + msg);
      return { ok: false, model, error: msg };
    }
  } catch (e) {
    console.log('💥 ' + model + ': ' + e.message);
    return { ok: false, model, error: e.message };
  }
}

console.log('🔍 Testing all FREE models...\n');

let workingModels = [];
for (const m of FREE_MODELS) {
  const result = await testModel(m);
  if (result.ok) workingModels.push(result.model);
  await new Promise(r => setTimeout(r, 1000));
}

console.log('\n--- ÖZET ---');
if (workingModels.length > 0) {
  console.log('✅ Çalışan modeller:', workingModels.join(', '));
} else {
  console.log('❌ Hiçbir free model çalışmıyor.');
}
