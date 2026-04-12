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
  },
  execute_command: async (args) => {
    const { command, args: cmdArgs = [] } = args;
    
    // Auto-split command string if provided as one
    let finalCmd = command;
    let finalArgs = cmdArgs;
    if (command && !cmdArgs.length) {
        const parts = command.split(' ');
        finalCmd = parts[0];
        finalArgs = parts.slice(1);
    }

    const result = await sandbox.executeCommand(finalCmd, finalArgs, process.cwd());
    
    return {
      content: [{
        type: "text",
        text: `💻 **Terminal Execution**\n\n` +
              `Command: \`${finalCmd} ${finalArgs.join(' ')}\`\n` +
              `Status: ${result.success ? '✅ Success' : '❌ Failed'}\n\n` +
              `**Output (stdout):**\n\`\`\`text\n${result.stdout || '(no output)'}\n\`\`\`\n\n` +
              `**Error (stderr):**\n\`\`\`text\n${result.stderr || '(no error)'}\n\`\`\``
      }],
      isError: !result.success
    };
  }
};
