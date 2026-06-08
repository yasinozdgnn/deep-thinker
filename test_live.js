import { callAI, callAIRaw } from './helpers/ai-client.js';

async function main() {
  console.log('🧪 Deep Thinker - Zen API Test\n');
  console.log('Provider: zen');
  console.log('Model:', process.env.ZEN_MODEL || 'deepseek-v4-flash-free');
  console.log('');
  
  // Test 1: Basic chat
  console.log('📝 Test 1: Deep Think Chat');
  try {
    const result = await callAI('Merhaba! Basit bir test: 1+1 kaç eder? Sadece sayı yaz.');
    console.log('✅ Yanıt:', result);
  } catch (e) {
    console.log('❌ Hata:', e.message);
  }
  
  console.log('');
  
  // Test 2: Code generation
  console.log('📝 Test 2: Code generation');
  try {
    const result = await callAI('Write a Go function that calculates fibonacci numbers. Return only the code.');
    console.log('✅ Yanıt:');
    console.log(result);
  } catch (e) {
    console.log('❌ Hata:', e.message);
  }
}

main();
