import { SandboxManager } from '../sandbox/index.js';

const sandbox = new SandboxManager();

export const executionHandlers = {
  run_in_sandbox: async (args) => {
    const { code, language = 'javascript', dependencies = [] } = args;
    
    // Safety check: Don't allow really dangerous things if possible
    // (Though local execution is inherently privileged)
    
    // Execute
    const result = await sandbox.execute(code, language, dependencies);
    
    return {
      content: [{
        type: "text",
        text: `📦 **Sandbox Execution Result**\n\n` +
              `Status: ${result.success ? '✅ Success' : '❌ Failed'}\n` +
              `Time: ${result.executionTime}ms\n\n` +
              `**Stdout:**\n\`\`\`text\n${result.stdout || '(empty)'}\n\`\`\`\n\n` +
              `**Stderr:**\n\`\`\`text\n${result.stderr || '(empty)'}\n\`\`\``
      }],
      isError: !result.success
    };
  }
};
