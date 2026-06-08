#!/usr/bin/env node

import { callAIStreaming } from '../helpers/ai-client.js';
import { executeToolLogic, detectTool, getAgentModules } from '../index.js';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.join(__dirname, '../.env');
dotenv.config({ path: ENV_PATH, quiet: true });

// ─── Color System ──────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",

  black:   "\x1b[30m",  red:  "\x1b[31m",  green:  "\x1b[32m",
  yellow:  "\x1b[33m",  blue: "\x1b[34m",  magenta:"\x1b[35m",
  cyan:    "\x1b[36m",  white:"\x1b[37m",

  bg: {
    red:  "\x1b[41m",  green:  "\x1b[42m",
    blue: "\x1b[44m",  yellow: "\x1b[43m",
  },

  fg256(code) { return `\x1b[38;5;${code}m`; },
  g1: "\x1b[38;5;39m",   g2: "\x1b[38;5;45m",   g3: "\x1b[38;5;51m",
  g4: "\x1b[38;5;87m",   g5: "\x1b[38;5;123m",
  gold:"\x1b[38;5;214m",
};

// ─── ENV Helpers ────────────────────────────────────────────────

function parseEnv(text) {
  const lines = text.split('\n');
  const vars = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

function setEnvVar(key, value) {
  let text = fs.readFileSync(ENV_PATH, 'utf-8');
  const escapedValue = value;
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(text)) {
    text = text.replace(regex, `${key}=${escapedValue}`);
  } else {
    text += `\n${key}=${escapedValue}`;
  }
  fs.writeFileSync(ENV_PATH, text, 'utf-8');
  process.env[key] = value;
}

// ─── Helpers ────────────────────────────────────────────────────

function gradient(text, colors) {
  return [...text].map((ch, i) => colors[i % colors.length] + ch).join('') + c.reset;
}

function box(title, content, titleColor = c.g1, borderColor = c.dim) {
  const w = process.stdout.columns || 72;
  const inner = w - 4;
  const lines = content.split('\n');
  const mid = lines.map(l =>
    borderColor + '│ ' + c.reset + (l || ' ').padEnd(inner, ' ') + borderColor + ' │' + c.reset
  ).join('\n');
  const bot = borderColor + '└' + '─'.repeat(inner) + '┘' + c.reset;

  const titleLen = title.length + 2;
  const titleStr = ' ' + titleColor + c.bold + title + c.reset + ' ';
  const leftPad = Math.floor((inner - titleLen) / 2);
  const topWithTitle = borderColor + '┌' + '─'.repeat(Math.max(0, leftPad)) +
    c.reset + titleStr + borderColor + '─'.repeat(Math.max(0, inner - leftPad - titleLen)) + '┘' + c.reset;

  return '\n' + topWithTitle + '\n' + mid + '\n' + bot + '\n';
}

function spinner(text = 'Processing') {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r${c.dim}${frames[i]} ${text}...${c.reset}`);
    i = (i + 1) % frames.length;
  }, 80);
  return {
    done(msg = '') {
      clearInterval(timer);
      process.stdout.write(`\r${c.green}●${c.reset} ${msg || text + ' '}`);
      if (msg) process.stdout.write('\n');
    },
    fail(msg = '') {
      clearInterval(timer);
      process.stdout.write(`\r${c.red}●${c.reset} ${msg || text + ' failed'}\n`);
    }
  };
}

function divider(char = '─', color = c.dim) {
  const w = process.stdout.columns || 72;
  console.log('  ' + color + char.repeat(Math.min(w - 2, 36)) + c.reset);
}

// ─── Model/Provider helpers ──────────────────────────────────────

function getProvider() {
  return process.env.AI_PROVIDER || 'openrouter';
}

function getModel() {
  return process.env.ZEN_MODEL || process.env.OPENROUTER_MODEL || 'deepseek-v4-flash-free';
}

const AVAILABLE_PROVIDERS = [
  { id: 'zen',      name: 'ZEN API',      desc: 'Ücretsiz modeller (deepseek, mimo, nemotron)', free: true },
  { id: 'openrouter', name: 'OpenRouter', desc: 'Çoklu model sağlayıcı (GPT, Claude, Gemini)', free: false },
  { id: 'gemini',   name: 'Google Gemini',desc: 'Google Gemini API (doğrudan SDK)', free: true },
  { id: 'go',       name: 'OpenCode Go',  desc: 'OpenCode Go ücretli API', free: false },
];

const ZEN_FREE_MODELS = [
  'deepseek-v4-flash-free',
  'mimo-v2.5-free',
  'nemotron-3-ultra-free',
  'nemotron-3-super-free',
];

function statusBar() {
  const provider = getProvider();
  const model = getModel();
  const right = `${c.dim}⚡ ${c.cyan}${provider}${c.dim}/${c.green}${model}${c.reset}`;
  const dots = c.dim + '·'.repeat(Math.max(2, (process.stdout.columns || 72) - right.length + 8)) + c.reset;
  return c.dim + '▸ ' + c.bold + 'deep-thinker' + c.reset + ' ' + dots + ' ' + right;
}

// ─── ASCII Banner ──────────────────────────────────────────────

function showBanner() {
  const w = process.stdout.columns || 72;

  const art = [
    `             ██████╗ ███████╗███████╗██████╗`,
    `             ██╔══██╗██╔════╝██╔════╝██╔══██╗`,
    `             ██║  ██║█████╗  █████╗  ██████╔╝`,
    `             ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝`,
    `             ██████╔╝███████╗███████╗██║`,
    `             ╚═════╝ ╚══════╝╚══════╝╚═╝`,
    `  ╔══════════════════════════════════════════════════════╗`,
    `  ║     Autonomous AI Agent — Multi-Model Swarm CLI     ║`,
    `  ╚══════════════════════════════════════════════════════╝`
  ];

  const gradColors = [c.g1, c.g2, c.g3, c.g4, c.g5, c.g4, c.g3, c.g2];
  const gradLine = (line) => {
    return [...line].map((ch, i) => gradColors[i % gradColors.length] + ch).join('') + c.reset;
  };

  console.log('');
  art.forEach(line => {
    const padded = line.padStart(Math.floor((w + line.length) / 2));
    console.log(gradLine(padded));
  });
  console.log('');
  console.log('  ' + statusBar());
  divider('━', `\x1b[38;5;237m`);
}

// ─── HELP ────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
  ${c.bold}${c.g1}DEEP THINKER${c.reset} ${c.dim}— Autonomous AI Agent CLI${c.reset}

  ${c.dim}Kullanım:${c.reset}  ${c.bold}deep-think${c.reset} ${c.cyan}<komut>${c.reset} ${c.green}[seçenekler]${c.reset}

  ${c.dim}══════════════════════════════════════════${c.reset}

  ${c.bold}${c.gold}🔧 ALT KOMUTLAR${c.reset}

    ${c.cyan}config set <key>=<value>${c.reset}   Kalıcı ayar değiştir
                           ${c.dim}Örn: provider=zen, model=deepseek-v4-flash-free${c.reset}
    ${c.cyan}config get <key>${c.reset}            Bir ayarı göster
    ${c.cyan}config list${c.reset}                 Tüm ayarları listele
    ${c.cyan}status${c.reset}                      API ve model durumunu göster
    ${c.cyan}models${c.reset}                      Kullanılabilir modelleri listele
    ${c.cyan}providers${c.reset}                   Desteklenen provider'ları listele

  ${c.bold}${c.gold}⚡ GEÇİCİ OVERRIDE${c.reset}

    ${c.cyan}--provider <id>${c.reset}             Provider'ı geçici değiştir
    ${c.cyan}--model <name>${c.reset}              Model'i geçici değiştir
                           ${c.dim}Geçici override sadece bu çalıştırma içindir.${c.reset}
                           ${c.dim}Kalıcı yapmak için: config set provider=...${c.reset}

  ${c.bold}${c.gold}💬 SORU / GÖREV${c.reset}

    ${c.cyan}deep-think "bir login sayfası yap"${c.reset}    Doğrudan soru sor
    ${c.cyan}deep-think --provider zen "kod yaz"${c.reset}   Provider seçerek

  ${c.bold}${c.gold}📋 DİĞER${c.reset}

    ${c.cyan}--help, -h${c.reset}                  Bu yardımı göster
    ${c.cyan}--version, -v${c.reset}               Versiyon bilgisi

  ${c.dim}══════════════════════════════════════════${c.reset}

  ${c.dim}İnteraktif mod: sadece ${c.reset}${c.bold}deep-think${c.reset}${c.dim} yazın, prompt ile kullanın.
  ${c.dim}Çıkmak için: ${c.reset}${c.bold}exit${c.reset}${c.dim} veya ${c.reset}${c.bold}Ctrl+C${c.reset}
`);
}

// ─── MODELS LIST ────────────────────────────────────────────────

function showModels() {
  const activeModel = getModel();
  const activeProvider = getProvider();

  console.log(`\n  ${c.bold}${c.g1}📦 ZEN API — Ücretsiz Modeller${c.reset}`);
  console.log(`  ${c.dim}${'─'.repeat(36)}${c.reset}`);
  for (const m of ZEN_FREE_MODELS) {
    const active = m === activeModel && activeProvider === 'zen';
    console.log(`  ${active ? c.green + '●' : c.dim + '○'}${c.reset} ${active ? c.bold : ''}${m}${c.reset}${active ? c.green + ' ← aktif' : ''}${c.reset}`);
  }

  console.log(`\n  ${c.bold}${c.g1}🔌 Desteklenen Provider'lar${c.reset}`);
  console.log(`  ${c.dim}${'─'.repeat(36)}${c.reset}`);
  for (const p of AVAILABLE_PROVIDERS) {
    const active = p.id === activeProvider;
    const keyOk = process.env[`${p.id.toUpperCase()}_API_KEY`] || 
                  (p.id === 'go' && process.env.GO_API_KEY) ||
                  (p.id === 'openrouter' && process.env.OPENROUTER_API_KEY);
    console.log(`  ${active ? c.green + '●' : c.dim + '○'}${c.reset} ${active ? c.bold : ''}${p.id}${c.reset}  ${c.dim}${p.desc}${c.reset} ${keyOk ? c.green + '✓' : c.red + '✗ anahtar yok'}`);
  }
  console.log('');
}

// ─── STATUS ──────────────────────────────────────────────────────

function showStatus() {
  const provider = getProvider();
  const model = getModel();
  const env = parseEnv(fs.readFileSync(ENV_PATH, 'utf-8'));

  const rows = [
    ['Provider', provider],
    ['Model', model],
    ['ZEN API Key', env.ZEN_API_KEY ? '✓ tanımlı' : '✗ eksik'],
    ['ZEN Model', env.ZEN_MODEL || '—'],
    ['OpenRouter Key', env.OPENROUTER_API_KEY ? '✓ tanımlı' : '✗ eksik'],
    ['Gemini Key', env.GEMINI_API_KEY ? '✓ tanımlı' : '✗ eksik'],
    ['Go API Key', env.GO_API_KEY ? '✓ tanımlı' : '✗ eksik'],
    ['Proxy Port', env.PROXY_PORT || '—'],
    ['OpenCode Path', env.OPENCODE_PATH || '—'],
    ['Node', process.version],
    ['Platform', process.platform],
    ['CWD', process.cwd()],
  ];

  const keyW = Math.max(...rows.map(r => r[0].length));
  const valW = Math.max(...rows.map(r => r[1].length));
  const boxW = keyW + valW + 7;

  console.log(`\n  ${c.bold}${c.g1}📊 Deep Thinker Status${c.reset}`);
  console.log(`  ${c.dim}┌${'─'.repeat(boxW)}┐${c.reset}`);
  for (const [key, val] of rows) {
    const coloredVal = val.includes('✓') ? c.green + val + c.reset
      : val.includes('✗') ? c.red + val + c.reset
      : c.white + val + c.reset;
    console.log(`  ${c.dim}│${c.reset} ${c.cyan}${key.padEnd(keyW)}${c.reset} ${c.dim}:${c.reset} ${coloredVal}${' '.repeat(Math.max(0, valW - val.length))} ${c.dim}│${c.reset}`);
  }
  console.log(`  ${c.dim}└${'─'.repeat(boxW)}┘${c.reset}\n`);
}

// ─── CONFIG COMMANDS ─────────────────────────────────────────────

function handleConfig(args) {
  const sub = args[0];
  if (!sub || sub === 'list') {
    const env = parseEnv(fs.readFileSync(ENV_PATH, 'utf-8'));
    const keys = ['AI_PROVIDER', 'ZEN_MODEL', 'OPENROUTER_MODEL', 'PROXY_PORT', 'OPENCODE_PATH', 'ZEN_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'GO_API_KEY'];
    console.log(`\n  ${c.bold}${c.g1}⚙️  Config${c.reset}\n`);
    for (const key of keys) {
      const val = env[key];
      if (!val) continue;
      const masked = key.includes('API_KEY') || key.includes('SECRET')
        ? val.slice(0, 4) + '****' + val.slice(-4)
        : val;
      console.log(`  ${c.cyan}${key.padEnd(22)}${c.reset} ${c.dim}=${c.reset} ${c.white}${masked}${c.reset}`);
    }
    console.log('');
    return;
  }

  if (sub === 'get') {
    const key = args[1];
    if (!key) { console.log(`  ${c.red}✗ Kullanım: config get <KEY>${c.reset}`); return; }
    const env = parseEnv(fs.readFileSync(ENV_PATH, 'utf-8'));
    const val = env[key];
    if (val === undefined) {
      console.log(`  ${c.yellow}! ${key} bulunamadı${c.reset}`);
    } else {
      console.log(`  ${c.cyan}${key}${c.reset} ${c.dim}=${c.reset} ${c.white}${val}${c.reset}`);
    }
    return;
  }

  if (sub === 'set') {
    const pair = args[1];
    if (!pair || !pair.includes('=')) {
      console.log(`  ${c.red}✗ Kullanım: config set <KEY>=<value>${c.reset}`);
      console.log(`  ${c.dim}  Örn: config set provider=zen${c.reset}`);
      console.log(`  ${c.dim}  Örn: config set model=deepseek-v4-flash-free${c.reset}`);
      return;
    }
    const eqIdx = pair.indexOf('=');
    let key = pair.slice(0, eqIdx).trim().toUpperCase();
    let value = pair.slice(eqIdx + 1).trim();

    // Normalize short names
    if (key === 'PROVIDER') {
      key = 'AI_PROVIDER';
    } else if (key === 'MODEL') {
      if (getProvider() === 'zen' || pair.includes('free')) {
        key = 'ZEN_MODEL';
      } else {
        key = 'OPENROUTER_MODEL';
      }
    }

    setEnvVar(key, value);
    console.log(`  ${c.green}✓ ${c.cyan}${key}${c.reset} ${c.dim}=${c.reset} ${c.white}${value}${c.reset}`);
    console.log(`  ${c.dim}  Kalıcı olarak kaydedildi.${c.reset}`);
    return;
  }

  console.log(`  ${c.red}✗ Bilinmeyen config alt komutu: ${sub}${c.reset}`);
  console.log(`  ${c.dim}  Kullanım: config list | get <key> | set <key>=<value>${c.reset}`);
}

// ─── ASK QUESTION ────────────────────────────────────────────────

async function askQuestion(query, options = {}) {
  const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.ZEN_API_KEY || process.env.GEMINI_API_KEY;
  if (!hasApiKey) {
    process.stderr.write(`\n${c.red}${c.bold}✖ ERROR:${c.reset} ${c.white}No API key found.${c.reset}`);
    process.stderr.write(`\n${c.dim}  Set OPENROUTER_API_KEY, ZEN_API_KEY, or GEMINI_API_KEY in .env${c.reset}\n`);
    process.exit(1);
  }

  // Geçici provider/model override
  const origProvider = process.env.AI_PROVIDER;
  const origZenModel = process.env.ZEN_MODEL;
  const origORModel = process.env.OPENROUTER_MODEL;
  if (options.provider) process.env.AI_PROVIDER = options.provider;
  if (options.model) {
    const prov = options.provider || origProvider || 'zen';
    if (prov === 'zen' || options.model.includes('free')) {
      process.env.ZEN_MODEL = options.model;
    } else {
      process.env.OPENROUTER_MODEL = options.model;
    }
  }

  try {
    const sp = spinner(`${c.dim}Analyzing request`);
    const toolDetection = await detectTool(query);

    if (toolDetection && toolDetection.tool && toolDetection.confidence > 0.6) {
      sp.done(`${c.green}${c.bold}Tool selected:${c.reset} ${c.cyan}${toolDetection.tool}${c.reset} ${c.dim}(${Math.round(toolDetection.confidence * 100)}% confidence)${c.reset}`);

      if (toolDetection.reasoning) {
        console.log(`  ${c.dim}└─ ${toolDetection.reasoning}${c.reset}`);
      }

      divider('─', `\x1b[38;5;240m`);
      const sp2 = spinner(`${c.yellow}Executing ${c.bold}${toolDetection.tool}${c.reset}${c.dim}`);

      const safeParams = toolDetection.parameters || {};
      const result = await executeToolLogic(toolDetection.tool, {
        ...safeParams,
        task: query,
        projectPath: process.cwd()
      });

      sp2.done(`${c.green}${c.bold}✓ Execution complete${c.reset}`);

      if (result.content && result.content[0]) {
        const text = result.content[0].text || '';
        console.log('\n' + text + '\n');
      }

      divider('━', `\x1b[38;5;237m`);
      return;
    }

    sp.done(`${c.magenta}${c.bold}Deep Thinking mode${c.reset}`);
    divider('─', `\x1b[38;5;240m`);

    let currentPhase = 'none';
    await callAIStreaming(query, (chunkObj) => {
      if (chunkObj.type === 'reasoning') {
        if (currentPhase !== 'reasoning') {
          console.log(`\n  ${c.yellow}${c.bold}🧠 Thinking Process${c.reset}`);
          console.log(`  ${c.dim}${'─'.repeat(28)}${c.reset}`);
          currentPhase = 'reasoning';
        }
        process.stdout.write(`${c.dim}${c.italic}${chunkObj.chunk}${c.reset}`);
      } else if (chunkObj.type === 'content') {
        if (currentPhase !== 'content') {
          process.stdout.write(`\n\n  ${c.green}${c.bold}💬 Response${c.reset}`);
          console.log(`\n  ${c.dim}${'─'.repeat(28)}${c.reset}`);
          currentPhase = 'content';
        }
        process.stdout.write(`${c.white}${chunkObj.chunk}${c.reset}`);
      }
    });

    process.stdout.write('\n');
    divider('━', `\x1b[38;5;237m`);

  } catch (error) {
    console.error(`\n  ${c.red}${c.bold}✖ Error:${c.reset} ${c.white}${error.message}${c.reset}`);
    divider('━', `\x1b[38;5;237m`);
  } finally {
    if (options.provider) process.env.AI_PROVIDER = origProvider;
    if (options.model) {
      if (origZenModel !== undefined) process.env.ZEN_MODEL = origZenModel;
      if (origORModel !== undefined) process.env.OPENROUTER_MODEL = origORModel;
    }
  }
}

// ─── Interactive Mode ──────────────────────────────────────────

function startInteractiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.bold}${c.g1}deep-think >${c.reset} `
  });

  showBanner();
  console.log(`  ${c.dim}${c.bold}Commands:${c.reset}  ${c.green}exit${c.reset}${c.dim}, ${c.green}quit${c.reset}${c.dim} to leave  │  ${c.gold}/help${c.reset}${c.dim} for help  │  ${c.gold}/status${c.reset}${c.dim} for status${c.reset}`);
  console.log(`  ${c.dim}Type anything to start — I'll auto-detect the right tool.${c.reset}\n`);

  rl.prompt();

  rl.on('line', async (line) => {
    const query = line.trim();
    if (!query) { rl.prompt(); return; }
    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      rl.close();
      return;
    }
    if (query === '?' || ['help', '/help'].includes(query.toLowerCase())) {
      showHelp();
      rl.prompt();
      return;
    }
    if (['/status', 'status'].includes(query.toLowerCase())) {
      showStatus();
      rl.prompt();
      return;
    }
    if (['models', '/models', 'providers'].includes(query.toLowerCase())) {
      showModels();
      rl.prompt();
      return;
    }

    await askQuestion(query);
    rl.prompt();
  }).on('close', () => {
    console.log(`\n  ${c.gold}${c.bold}✦${c.reset} ${c.dim}See you later!${c.reset} ${c.gold}✦${c.reset} ${c.dim}— Deep Thinker${c.reset}\n`);
    process.exit(0);
  });
}

// ─── Entry Point ────────────────────────────────────────────────

async function main() {
  getAgentModules(process.cwd());

  const args = process.argv.slice(2);

  // Hiç argüman yoksa interaktif mod
  if (args.length === 0) {
    startInteractiveMode();
    return;
  }

  // ─── Argümanları parse et ──────────────────────────────────────

  let providerOverride = null;
  let modelOverride = null;
  let positionalArgs = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      showBanner();
      showHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
      console.log(`Deep Thinker v${pkg.version}`);
      process.exit(0);
    } else if (arg === '--provider') {
      providerOverride = args[++i];
      if (!providerOverride) {
        console.error(`${c.red}✗ --provider <name> gerekli${c.reset}`);
        process.exit(1);
      }
    } else if (arg === '--model') {
      modelOverride = args[++i];
      if (!modelOverride) {
        console.error(`${c.red}✗ --model <name> gerekli${c.reset}`);
        process.exit(1);
      }
    } else {
      positionalArgs.push(arg);
    }
    i++;
  }

  // ─── Alt komutları işle ──────────────────────────────────────────

  const cmd = positionalArgs[0];

  if (cmd === 'help') {
    showBanner();
    showHelp();
    process.exit(0);
  }

  if (cmd === 'version') {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
    console.log(`Deep Thinker v${pkg.version}`);
    process.exit(0);
  }

  if (cmd === 'status') {
    showBanner();
    showStatus();
    process.exit(0);
  }

  if (cmd === 'models' || cmd === 'model' || cmd === 'providers' || cmd === 'provider') {
    showBanner();
    showModels();
    process.exit(0);
  }

  if (cmd === 'config') {
    showBanner();
    handleConfig(positionalArgs.slice(1));
    process.exit(0);
  }

  // ─── Soru / görev ────────────────────────────────────────────────

  showBanner();
  await askQuestion(cmd || positionalArgs.join(' '), {
    provider: providerOverride,
    model: modelOverride,
  });
}

main();
