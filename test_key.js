import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const KEY = process.env.ZEN_API_KEY || '';
const BASE_URL = (process.env.ZEN_API_BASE_URL || 'https://opencode.ai/zen/v1').replace(/\/+$/, '');
const GO_URL = (process.env.GO_API_BASE_URL || 'https://opencode.ai/zen/go/v1').replace(/\/+$/, '');

async function run() {
  console.log('🔑 KEY control:');
  console.log('  Length:', KEY.length);
  console.log('  Starts with:', KEY.startsWith('sk-') ? '✅ sk-' : '❌');
  console.log('  Raw bytes:', Buffer.from(KEY).toString('hex').substring(0, 20) + '...');
  
  // Test with explicit curl-style approach using axios
  const payload = {
    model: 'claude-haiku-4-5',
    messages: [{ role: 'user', content: '1+1=? Just number.' }],
    max_tokens: 5
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + KEY
  };
  
  console.log('\n📡 Testing Zen endpoint:');
  console.log('  URL:', BASE_URL + '/chat/completions');
  console.log('  Auth header length:', headers['Authorization'].length);
  
  try {
    const response = await axios.post(
      BASE_URL + '/chat/completions', 
      payload, 
      { headers, timeout: 20000, validateStatus: () => true }
    );
    console.log('  Status:', response.status);
    if (response.status === 200) {
      console.log('  ✅ Success:', response.data.choices[0].message.content);
    } else {
      console.log('  Error body:', JSON.stringify(response.data).substring(0, 200));
    }
  } catch (e) {
    console.log('  Connection error:', e.message);
  }
  
  // Try without model to see API docs
  console.log('\n📡 Testing GET /models:');
  try {
    const response = await axios.get(BASE_URL + '/models', { 
      headers, 
      timeout: 10000,
      validateStatus: () => true 
    });
    console.log('  Status:', response.status);
    if (response.status === 200) {
      const models = response.data.data || [];
      console.log('  Total models:', models.length);
      console.log('  First 5:', models.slice(0, 5).map(m => m.id).join(', '));
    } else {
      console.log('  Body:', JSON.stringify(response.data).substring(0, 200));
    }
  } catch (e) {
    console.log('  Connection error:', e.message);
  }
}

run();
