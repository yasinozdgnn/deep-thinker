import { ArchitectAgent, CoderAgent, QAAgent } from './agents.js';

export class SwarmOrchestrator {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.architect = new ArchitectAgent();
    this.coder = new CoderAgent();
    this.qa = new QAAgent();
    this.history = [];
  }

  async runSwarm(task) {
    this.log('🚀 Swarm started for task: ' + task);

    // 1. Architect Phase
    this.log('🏗️ Architect is designing...');
    const design = await this.architect.think({ task, projectContext: this.projectPath });
    this.history.push({ role: 'architect', content: design });
    
    // 2. Coder Phase
    this.log('👨‍💻 Coder is implementing...');
    const code = await this.coder.think({ task, design });
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
