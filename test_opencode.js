import { opencodeHandlers } from './handlers/opencode.js';

async function main() {
  console.log('🧪 OpenCode API Tests\n');

  // Test 1: OpenCode Run
  console.log('📝 Test 1: opencode_run');
  const result1 = await opencodeHandlers.opencode_run({
    task: 'Write a JavaScript function that reverses a string. Return only the code.',
    model: 'deepseek-v4-flash-free'
  });
  console.log(result1.content[0].text.substring(0, 400));
  console.log('');

  // Test 2: OpenCode Go Run
  console.log('📝 Test 2: opencode_go_run');
  const result2 = await opencodeHandlers.opencode_go_run({
    task: 'Write a simple Go HTTP server that listens on port 8080 and returns "Hello, World!" on /',
    model: 'minimax-m3'
  });
  console.log(result2.content[0].text.substring(0, 400));
  console.log('');

  // Test 3: OpenCode with Thinking
  console.log('📝 Test 3: opencode_run_with_thinking');
  const result3 = await opencodeHandlers.opencode_run_with_thinking({
    task: 'Explain what a goroutine is in Go. Keep it short.',
    model: 'deepseek-v4-flash-free'
  });
  console.log(result3.content[0].text.substring(0, 400));
  
  console.log('\n✅ Tüm testler tamamlandı!');
}

main().catch(e => console.error('❌', e));
