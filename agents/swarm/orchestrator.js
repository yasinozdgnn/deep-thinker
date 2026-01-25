import { ArchitectAgent, CoderAgent, QAAgent } from './agents.js';
import { SandboxManager } from '../../sandbox/index.js';
import { extractCodeFromResponse } from '../../helpers/index.js';

export class SwarmOrchestrator {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.architect = new ArchitectAgent();
    this.coder = new CoderAgent();
    this.qa = new QAAgent();
    this.sandbox = new SandboxManager();
    this.history = [];
  }

  async runSwarm(task) {
    this.log('🚀 Swarm started for task: ' + task);

    // 1. Architect Phase
    this.log('🏗️ Architect is designing...');
    const design = await this.architect.think({ task, projectContext: this.projectPath });
    this.history.push({ role: 'architect', content: design });
    
    // 2. Coder Phase (with Sandbox Verification)
    this.log('👨‍💻 Coder is implementing...');
    let code = await this.coder.think({ task, design });
    
    // Attempt verification loop (max 3 retries)
    let verified = false;
    let attempts = 0;
    
    while (!verified && attempts < 3) {
      const cleanCode = extractCodeFromResponse(code) || code;
      
      // Determine language loosely (assume js for simplicity or detect)
      const isPhp = cleanCode.includes('<?php');
      const lang = isPhp ? 'php' : 'javascript';
      
      this.log(`📦 Verifying code in Sandbox (${lang})... (Attempt ${attempts + 1})`);
      const execution = await this.sandbox.execute(cleanCode, lang);
      
      if (execution.success) {
        this.log('✅ Sandbox verification PASSED.');
        verified = true;
      } else {
        this.log(`❌ Sandbox verification FAILED: ${execution.stderr.slice(0, 200)}...`);
        this.log('🔄 Coder is fixing the code...');
        
        const fixPrompt = `The previous code failed to execute in the sandbox.
Error: ${execution.stderr}

Fix the code and return the complete corrected version.
Previous Code:
${cleanCode}`;

        code = await this.coder.think({ task: "Fix compilation/runtime error", design: fixPrompt });
        attempts++;
      }
    }
    
    this.history.push({ role: 'coder', content: code });

    // 3. QA Phase
    this.log('🧪 QA is verifying...');
    const testReport = await this.qa.think({ code });
    this.history.push({ role: 'qa', content: testReport });

    this.log('✅ Swarm finished.');

    return {
      design,
      code,
      testReport,
      summary: 'Swarm completed all phases.'
    };
  }

  log(message) {
    console.log(`[SWARM] ${message}`);
  }
}
