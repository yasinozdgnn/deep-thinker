#!/usr/bin/env node

import { callGLMStreaming } from '../helpers/glm-client.js';
import { executeToolLogic, detectTool, getAgentModules } from '../index.js';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from the correct location
dotenv.config({ path: path.join(__dirname, '../.env') });

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  white: "\x1b[37m"
};

const PROJECT_PATH = process.cwd();

async function askQuestion(query) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error(`${colors.red}Error: OPENROUTER_API_KEY is not set.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.cyan}🔍 Agent is analyzing your request...${colors.reset}`);
  
  try {
    // 1. Tool Detection Phase
    const toolDetection = await detectTool(query);
    
    if (toolDetection && toolDetection.tool && toolDetection.confidence > 0.6) {
      console.log(`${colors.magenta}🛠️  Detected Tool: ${colors.bright}${toolDetection.tool}${colors.reset} (Confidence: ${Math.round(toolDetection.confidence * 100)}%)`);
      console.log(`${colors.dim}Reasoning: ${toolDetection.reasoning}${colors.reset}\n`);

      // 2. Tool Execution Phase
      process.stdout.write(`${colors.yellow}⚙️  Executing tool...${colors.reset}\r`);
      
      const safeParams = toolDetection.parameters || {};
      const result = await executeToolLogic(toolDetection.tool, { 
        ...safeParams, 
        task: query, 
        projectPath: PROJECT_PATH 
      });
      
      console.log(`\n${colors.green}✅ Tool Execution Result:${colors.reset}`);
      if (result.content && result.content[0]) {
        console.log(`${colors.white}${result.content[0].text}${colors.reset}\n`);
      }
      return;
    }

    // 3. General Chat / Deep Thinking Phase with Streaming
    console.log(`${colors.cyan}🧠 Deep Thinking started...${colors.reset}\n`);
    
    let currentPhase = 'none';
    const streamResult = await callGLMStreaming(query, (chunkObj) => {
      if (chunkObj.type === 'reasoning') {
        if (currentPhase !== 'reasoning') {
          console.log(`${colors.bright}${colors.yellow}--- Thinking Process ---${colors.reset}`);
          currentPhase = 'reasoning';
        }
        process.stdout.write(`${colors.dim}${colors.italic}${chunkObj.chunk}${colors.reset}`);
      } else if (chunkObj.type === 'content') {
        if (currentPhase !== 'content') {
          process.stdout.write(`\n\n${colors.bright}${colors.green}--- Response ---${colors.reset}\n`);
          currentPhase = 'content';
        }
        process.stdout.write(`${colors.white}${chunkObj.chunk}${colors.reset}`);
      }
    });

    process.stdout.write('\n');
  } catch (error) {
    console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
  }
}

function startInteractiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.cyan}deep-think > ${colors.reset}`
  });

  console.log(`${colors.bright}${colors.magenta}=== Deep Thinker Agentic CLI ===${colors.reset}`);
  console.log(`Type your request (e.g., 'list files', 'fix code', 'hello').`);
  console.log(`Commands: 'exit', 'quit' to leave.\n`);

  rl.prompt();

  rl.on('line', async (line) => {
    const query = line.trim();
    if (!query) { rl.prompt(); return; }
    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      rl.close();
      return;
    }

    await askQuestion(query);
    rl.prompt();
  }).on('close', () => {
    console.log(`\n${colors.yellow}Goodbye!${colors.reset}`);
    process.exit(0);
  });
}

// Global Agent Initialization
getAgentModules(PROJECT_PATH);

const args = process.argv.slice(2);
if (args.length > 0) {
  askQuestion(args.join(' '));
} else {
  startInteractiveMode();
}
