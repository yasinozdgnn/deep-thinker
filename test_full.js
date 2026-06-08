import { executeToolLogic } from './index.js';

async function main() {
  console.log('🧪 MCP Tool Dispatch Tests\n');
  
  // Test 1: deep_think_chat (uses callAI -> Zen API)
  console.log('📝 Test 1: deep_think_chat');
  try {
    const r = await executeToolLogic('deep_think_chat', { prompt: 'Türkiyenin başkenti neresidir? Sadece şehir adı.' });
    console.log('✅:', r.content[0].text.substring(0, 200));
  } catch (e) {
    console.log('❌:', e.message);
  }
  console.log('');
  
  // Test 2: opencode_run via dispatcher
  console.log('📝 Test 2: opencode_run via executeToolLogic');
  try {
    const r = await executeToolLogic('opencode_run', { task: 'Write hello world in Python. Return only code.', model: 'deepseek-v4-flash-free' });
    console.log('✅:', r.content[0].text.substring(0, 300));
  } catch (e) {
    console.log('❌:', e.message);
  }
  console.log('');

  // Test 3: opencode_go_run via dispatcher
  console.log('📝 Test 3: opencode_go_run via executeToolLogic');
  try {
    const r = await executeToolLogic('opencode_go_run', { task: 'Write Go hello world. Return only code.', model: 'minimax-m3' });
    const status = r.isError ? '❌' : '✅';
    console.log(status, ':', r.content[0].text.substring(0, 300));
  } catch (e) {
    console.log('❌:', e.message);
  }
  console.log('');

  // Test 4: Sandbox with Go
  console.log('📝 Test 4: run_in_sandbox with Go');
  try {
    const r = await executeToolLogic('run_in_sandbox', { 
      code: 'package main\nimport "fmt"\nfunc main() { fmt.Println("Hello from Go!") }',
      language: 'go' 
    });
    console.log('✅:', r.content[0].text.substring(0, 200));
  } catch (e) {
    console.log('❌:', e.message);
  }
  console.log('');

  // Test 5: List tools - just verify it loads all tools
  console.log('📝 Test 5: Tool count verification');
  const { tools } = await import('./tools/index.js');
  console.log('Toplam tool sayısı:', tools.length);
  
  const opencodeTools = tools.filter(t => t.name.startsWith('opencode'));
  console.log('OpenCode tool\'ları:', opencodeTools.map(t => t.name).join(', '));
  
  const goTools = tools.filter(t => t.name.includes('go'));
  console.log('Go ile ilgili tool\'lar:', goTools.map(t => t.name).join(', '));
  
  // Test 6: Provider info
  console.log('\n📝 Test 6: Provider config');
  console.log('AI_PROVIDER:', process.env.AI_PROVIDER);
  console.log('ZEN_MODEL:', (await import('./helpers/glm-client.js')).then?._model || 'N/A');
  
  console.log('\n✅ Tüm testler tamamlandı!');
}

main().catch(e => {
  console.error('💥', e);
  process.exit(1);
});
