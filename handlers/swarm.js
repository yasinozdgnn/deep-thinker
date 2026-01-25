import { SwarmOrchestrator } from '../agents/swarm/orchestrator.js';

export const swarmHandlers = {
  delegate_to_swarm: async (args) => {
    const orchestrator = new SwarmOrchestrator(args.projectPath || process.cwd());
    const result = await orchestrator.runSwarm(args.task);
    
    return {
      content: [{
        type: "text",
        text: `🐝 **Swarm Execution Report**\n\n` +
              `### 🏗️ Architect's Design\n${result.design}\n\n` +
              `### 👨‍💻 Implementation\n${result.code}\n\n` +
              `### 🧪 QA Report\n${result.testReport}`
      }]
    };
  }
};
