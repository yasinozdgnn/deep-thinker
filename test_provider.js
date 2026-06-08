import { callAI, callAIWithThinking } from './helpers/ai-client.js';

console.log('=== Testing ZEN API via new provider system ===\n');
console.log('Provider:', process.env.AI_PROVIDER || 'zen');
console.log('Model:', process.env.ZEN_MODEL || 'deepseek-v4-flash-free');
console.log('');

// Test 1: Simple call
try {
  const r1 = await callAI('Merhaba! Nasılsın? Kısa cevap ver.');
  console.log('✅ Test 1 (simple):', r1.substring(0, 100));
} catch (e) {
  console.log('❌ Test 1 failed:', e.message.substring(0, 100));
}

// Test 2: With thinking
try {
  const r2 = await callAIWithThinking('1+1=? Sadece sayı.');
  console.log('✅ Test 2 (thinking):', JSON.stringify({ content: r2.content?.substring(0, 50), hasThinking: !!r2.thinking }));
} catch (e) {
  console.log('❌ Test 2 failed:', e.message.substring(0, 100));
}

console.log('\n✅ All provider tests completed');
