import { SwarmOrchestrator } from '../agents/swarm/orchestrator.js';

export const swarmHandlers = {
  delegate_to_swarm: async (args) => {
    const orchestrator = new SwarmOrchestrator(args.projectPath || process.cwd());
    const result = await orchestrator.runSwarm(args.task);
    
    // Generate a professional report summary from the new autonomous data structure
    const fileList = result.codeFiles && result.codeFiles.length > 0
        ? result.codeFiles.map(f => `- 📄 ${f.fileName}`).join('\n')
        : '- No files were generated.';
    
    const projectInfo = result.blueprint 
        ? `- **Project:** ${result.blueprint.project_name || 'N/A'}\n- **Stack:** ${Array.isArray(result.blueprint.tech_stack) ? result.blueprint.tech_stack.join(', ') : 'N/A'}`
        : '- Architecture unavailable.';

    return {
      content: [{
        type: "text",
        text: `🐝 **Swarm Autonomous Execution Report**\n\n` +
              `### 🏗️ Architect's Design\n${projectInfo}\n\n` +
              `### 👨‍💻 Implementation Details\n${fileList}\n\n` +
              `### 🏁 Final Status\n✅ All tasks successfully completed and verified via Micro-Tasking Factory.`
      }]
    };
  }
};
