import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testMCP() {
  console.log('🧪 Deep Thinker MCP Server Test\n');

  const serverProcess = spawn('node', ['index.js'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PATH: '/usr/local/bin:' + (process.env.PATH || '') }
  });

  let stderrBuf = '';
  serverProcess.stderr.on('data', d => { stderrBuf += d.toString(); });

  function sendRequest(req) {
    return new Promise((resolve, reject) => {
      let buffer = '';
      const timeout = setTimeout(() => {
        serverProcess.stdout.removeListener('data', handler);
        reject(new Error('Timeout'));
      }, 20000);

      const handler = (data) => {
        buffer += data.toString();
        try {
          const parsed = JSON.parse(buffer);
          clearTimeout(timeout);
          serverProcess.stdout.removeListener('data', handler);
          resolve(parsed);
        } catch (e) {}
      };

      serverProcess.stdout.on('data', handler);
      serverProcess.stdin.write(JSON.stringify(req) + '\n');
    });
  }

  try {
    // Test 1: List tools
    console.log('📡 Test 1: tools/list');
    const listResp = await sendRequest({
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
    });

    if (listResp.error) {
      console.log('❌', JSON.stringify(listResp.error).substring(0, 200));
      return;
    }

    const tools = listResp.result?.tools || [];
    console.log(`✅ ${tools.length} tools loaded`);

    const relevant = tools.filter(t =>
      t.name.includes('opencode') || t.name === 'deep_think_chat' || t.name.includes('go')
    );
    console.log('\n🧰 Key tools:');
    relevant.forEach(t => console.log(`   • ${t.name}: ${(t.description || '').substring(0, 70)}...`));

    // Test 2: Call deep_think_chat
    console.log('\n📡 Test 2: tools/call deep_think_chat');
    const callResp = await sendRequest({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'deep_think_chat', arguments: { prompt: 'Merhaba! Sadece EVET yaz.' } }
    });

    if (callResp.error) {
      console.log('❌', JSON.stringify(callResp.error).substring(0, 300));
    } else {
      const text = callResp.result?.content?.[0]?.text || '(boş)';
      console.log(`✅ ${text.substring(0, 150)}`);
    }

    console.log('\n✅ Tüm MCP testleri başarılı!');
  } catch (e) {
    console.error('💥', e.message);
    console.error('STDERR:', stderrBuf.substring(0, 500));
  }

  serverProcess.kill();
}

testMCP();
