import { callGo } from './helpers/providers/go.js';

console.log('=== Testing GO API (OpenCode Go / Gemini) ===\n');

try {
  const result = await callGo('What is 2+2? Just number.', { 
    model: 'gemini-2.0-flash',
    maxTokens: 10
  });
  console.log('✅ GO API result:', result.substring(0, 100));
} catch (e) {
  console.log('❌ GO API failed:', e.message.substring(0, 150));
}

console.log('\nTest complete');
