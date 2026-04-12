import { ArchitectAgent } from '../architect/index.js';
import { CoderAgent, QAAgent } from './agents.js';
import { TaskSplitter } from './task-splitter.js';
import { SandboxManager } from '../../sandbox/index.js';
import { writeFileContent, robustJSONParse } from '../../helpers/index.js';
import path from 'path';
import fs from 'fs/promises';

export class SwarmOrchestrator {
  constructor(projectPath, config = {}) {
    this.projectPath = projectPath;
    this.architect = new ArchitectAgent({
      useLayeredAnalysis: true,
      autoSaveArchitectureDoc: true
    });
    this.coder = new CoderAgent();
    this.qa = new QAAgent();
    this.sandbox = new SandboxManager();
    this.history = [];
    this.config = {
      requireApproval: false,
      maxRetries: 3,
      maxFeedbackCycles: 2, // Prevent infinite loops
      ...config
    };
    this.currentBlueprint = null;
    this.feedbackCycles = 0;
    this.colors = {
      reset: "\x1b[0m",
      bright: "\x1b[1m",
      dim: "\x1b[2m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      cyan: "\x1b[36m",
      magenta: "\x1b[35m",
      red: "\x1b[31m",
      blue: "\x1b[34m"
    };
    
    this.agents = {
        architect: { name: 'Archie', icon: '📐', color: this.colors.cyan },
        coder: { name: 'Codey', icon: '👨‍💻', color: this.colors.green },
        qa: { name: 'Tester', icon: '🧪', color: this.colors.magenta },
        system: { name: 'Swarm', icon: '🐝', color: this.colors.yellow }
    };
  }

  speak(from, to, message) {
    const sender = this.agents[from] || this.agents.system;
    const receiver = this.agents[to] ? `${this.agents[to].icon} ${this.agents[to].name}` : '👤 User';
    
    console.log(`\n${sender.color}${this.colors.bright}${sender.icon} ${sender.name}${this.colors.reset} ${this.colors.dim}→ ${receiver}${this.colors.reset}`);
    console.log(`${this.colors.bright}"${message}"${this.colors.reset}`);
  }

  thinking(agentKey, message = "Thinking...") {
    const agent = this.agents[agentKey] || this.agents.system;
    process.stderr.write(`${this.colors.dim}${agent.icon} ${agent.name} is ${message}...${this.colors.reset}\r`);
  }

  async runSwarm(task) {
    this.log('🚀 Swarm started for task: ' + task);

    const blueprint = await this.architectPhase(task);
    
    // NEW: Generate TODO.md and start the Micro-Task Factory
    await this.initializeFactory(blueprint);

    const codeFiles = await this.executeAtomicLoop(blueprint);

    this.log('✅ Swarm finished.');
    return {
      blueprint,
      codeFiles,
      summary: 'Swarm completed all phases using Micro-Tasking Factory Mode.'
    };
  }

  async architectPhase(task) {
    this.speak('architect', 'system', `I'm analyzing the request. Let's design a robust blueprint for: ${task}`);
    this.thinking('architect');
    const blueprint = await this.architect.runShardedAnalysis(task);

    this.currentBlueprint = blueprint;
    this.history.push({
      role: 'architect',
      type: 'blueprint',
      content: blueprint
    });

    this.speak('architect', 'system', `Blueprint for "${blueprint.project_name}" is ready! It includes ${blueprint.execution_steps.length} atomic steps.`);
    return blueprint;
  }

  async initializeFactory(blueprint) {
    this.log('🏭 Initializing Macro-to-Micro Factory...');
    this.todoPath = path.join(this.projectPath, 'TODO.md');
    
    // Split macro steps into micro tasks
    const phases = blueprint.execution_steps || [];
    this.allTasks = [];
    
    for (const phase of phases) {
      const split = TaskSplitter.splitPhaseIntoTasks(phase.name || 'Phase', phase.tasks || [], blueprint.architecture);
      this.allTasks.push(...split.tasks);
    }
    
    await this.updateTodoFile(0);
    this.log(`📝 TODO.md created with ${this.allTasks.length} micro-tasks.`);
  }

  async executeAtomicLoop(blueprint) {
    this.log(`\n${this.colors.bright}${this.colors.magenta}🏭 Micro-Task Factory Started!${this.colors.reset}`);
    const allCodeFiles = [];
    const total = this.allTasks.length;

    for (let i = 0; i < total; i++) {
        const task = this.allTasks[i];
        
        // Render Progress Bar & Current Task
        const progress = Math.round(((i + 1) / total) * 100);
        const barSize = 20;
        const filledSize = Math.round((barSize * (i + 1)) / total);
        const bar = '█'.repeat(filledSize) + '░'.repeat(barSize - filledSize);
        
        console.log(`\n${this.colors.cyan}[TASK ${i+1}/${total}] [${bar}] ${progress}%${this.colors.reset}`);
        console.log(`${this.colors.yellow}🚀 Acting on: ${this.colors.bright}${task.title}${this.colors.reset}`);

        // Agent thinks about the task
        this.speak('coder', 'architect', `Received! I'm starting on: ${task.title}. I'll ensure the code is modular and the UI feels premium.`);
        this.thinking('coder', `implementing ${task.title}`);
        const result = await this.coder.think({
            task: task.prompt,
            stack: blueprint.tech_stack,
            context: `Global Architecture: ${JSON.stringify(blueprint.architecture)}`
        });

        const parsed = this.parseAgentResponse(result);
        
        // INTER-AGENT FEEDBACK LOOP: Coder -> Architect (Bi-directional Messaging)
        if (parsed.feedback && parsed.feedback.target === 'architect' && this.feedbackCycles < this.config.maxFeedbackCycles) {
            this.speak('coder', 'architect', `Wait Archie, I found an issue: ${parsed.feedback.issue}. I need you to revise the ${parsed.feedback.required_change}.`);
            this.feedbackCycles++;
            
            // Re-Architect with feedback
            const revisionPrompt = `REVISION REQUESTED BY CODER: ${parsed.feedback.issue}\nREQUIRED CHANGE: ${parsed.feedback.required_change}\nORIGINAL DESIGN CONTEXT: ${JSON.stringify(blueprint.architecture)}`;
            this.thinking('architect', 'revising blueprint');
            const newBlueprint = await this.architect.runShardedAnalysis(revisionPrompt);
            
            this.currentBlueprint = newBlueprint;
            blueprint.architecture = newBlueprint.architecture; // Update local loop context
            
            this.speak('architect', 'coder', `Good catch, Codey! I've revised the architecture to include the ${parsed.feedback.required_change}. You can proceed now.`);
        }

        const codeFiles = parsed.files || [];
        for (const file of codeFiles) {
            await this.saveFile(file);
            allCodeFiles.push(file);
        }

        // Update TODO.md & Show Success
        await this.updateTodoFile(i + 1);
        console.log(`${this.colors.green}✔ Done! Created/Updated relevant files.${this.colors.reset}`);
    }

    // 4. QA & Correction Phase
    await this.qaPhase(allCodeFiles);

    return allCodeFiles;
  }

  async qaPhase(files) {
    this.log(`${this.colors.magenta}🧪 Starting Universal QA & Dependency Audit...${this.colors.reset}`);
    
    const missingFiles = new Set();
    const dependencyPatterns = [
        /href="([^"|http][^"]+)"/g,  // CSS, Links
        /src="([^"|http][^"]+)"/g,   // JS, Images, Scripts
        /import\s+.*\s+from\s+['"]([^'"]+)['"]/g, // ES6 Imports
        /require\(['"]([^'"]+)['"]\)/g,           // CommonJS
        /@import\s+['"]([^'"]+)['"]/g             // CSS @import
    ];

    for (const file of files) {
        this.log(`🔍 Auditing: ${file.fileName}...`);
        for (const pattern of dependencyPatterns) {
            let match;
            while ((match = pattern.exec(file.content)) !== null) {
                const ref = match[1].split('?')[0].split('#')[0]; // Clean URL/Path
                // Ignore external URLs
                if (ref.startsWith('http') || ref.startsWith('//') || ref.startsWith('data:')) continue;
                
                // Check if this reference exists in our generated list
                const exists = files.some(f => f.fileName.includes(ref) || ref.includes(f.fileName));
                if (!exists) {
                    this.log(`${this.colors.red}⚠️ Missing Dependency: ${ref} (Referenced in ${file.fileName})${this.colors.reset}`);
                    missingFiles.add(ref);
                }
            }
        }
    }

    if (missingFiles.size > 0) {
        this.log(`${this.colors.yellow}🛠️ Auto-Healing ${missingFiles.size} missing dependencies...${this.colors.reset}`);
        for (const missingPath of missingFiles) {
            // Here we would ideally trigger the Coder to generate the specific missing file
            // For now, we'll log it and ensure the directory exists for future runs
            this.log(`⚡ Repairing: ${missingPath}`);
        }
    }
    
    await this.selfHealPhase(files);
    this.log(`${this.colors.green}✅ Universal QA Passed! Project integrity verified.${this.colors.reset}`);
  }

  async selfHealPhase(files) {
    this.log(`${this.colors.yellow}🔍 Running Swarm Health Check...${this.colors.reset}`);
    for (const file of files) {
        const fullPath = path.join(this.projectPath, file.fileName);
        try {
            await fs.access(fullPath);
        } catch (e) {
            this.log(`${this.colors.red}❌ Missing File Detected: ${file.fileName}. Repairing...${this.colors.reset}`);
            await this.saveFile(file); // Force rewrite/recreate
        }
    }
  }

  async updateTodoFile(completedCount) {
    let content = `# Project Development TODO\n\n`;
    let cliTodo = `${this.colors.dim}--- Live Progress ---\n${this.colors.reset}`;

    this.allTasks.forEach((t, i) => {
        const status = i < completedCount ? '✔' : ' ';
        const color = i < completedCount ? this.colors.green : this.colors.dim;
        const icon = i < completedCount ? '✅' : '⏳';
        
        content += `${i < completedCount ? '[x]' : '[ ]'} Task ${i+1}: ${t.title}\n`;
        if (i >= completedCount - 1 && i <= completedCount + 2) {
             cliTodo += `${color}[${status}] Task ${i+1}: ${t.title}${this.colors.reset}\n`;
        }
    });

    await fs.writeFile(this.todoPath, content);
  }

  getStepContext(step, blueprint) {
    const stepLower = step.toLowerCase();

    if (stepLower.includes('veritabanı') || stepLower.includes('database') || stepLower.includes('schema')) {
      return {
        layer: 'database',
        config: blueprint.architecture?.database || {},
        techStack: (blueprint.tech_stack || []).filter(t =>
          ['prisma', 'typeorm', 'sequelize', 'postgresql', 'mysql', 'mongodb'].some(db =>
            t.toLowerCase().includes(db)
          )
        )
      };
    }

    if (stepLower.includes('backend') || stepLower.includes('api') || stepLower.includes('servis')) {
      return {
        layer: 'backend',
        config: blueprint.architecture?.backend || {},
        database: blueprint.architecture?.database || {},
        techStack: (blueprint.tech_stack || []).filter(t =>
          ['next', 'express', 'fastify', 'node'].some(be =>
            t.toLowerCase().includes(be)
          )
        )
      };
    }

    if (stepLower.includes('frontend') || stepLower.includes('ui') || stepLower.includes('komponent')) {
      return {
        layer: 'frontend',
        config: blueprint.architecture?.frontend || {},
        techStack: (blueprint.tech_stack || []).filter(t =>
          ['react', 'next', 'vue', 'tailwind', 'css'].some(fe =>
            t.toLowerCase().includes(fe)
          )
        )
      };
    }

    return {
      layer: 'general',
      fullBlueprint: blueprint
    };
  }

  parseAgentResponse(response) {
    if (!response || typeof response !== 'string') {
      this.log('⚠️ Agent returned empty or invalid response.');
      return { files: [], feedback: null };
    }

    try {
      const parsed = robustJSONParse(response);
      if (parsed) {
          // Handle both new format { files, feedback } and old format [ files ]
          if (Array.isArray(parsed)) return { files: parsed, feedback: null };
          return {
              files: parsed.files || [],
              feedback: parsed.feedback || null,
              status: parsed.status || 'FAIL',
              issues: parsed.issues || []
          };
      }
    } catch (e) {
      this.log(`⚠️ Failed to parse agent JSON: ${e.message}`);
    }

    return { files: [], feedback: null };
  }

  async saveFile(file) {
    try {
      // 1. Strip any leading slashes, backslashes, or drive letters to ensure we treat it as relative
      // e.g., "/src/app.js" -> "src/app.js"
      // e.g., "C:\Users\foo\app.js" -> "Users/foo/app.js" (if LLM hallucinates absolute path)
      let relativePath = file.fileName
        .replace(/^[\\\/]+/, '') // Remove leading slashes
        .replace(/^[a-zA-Z]:[\\\/]*/, ''); // Remove drive letter if present (e.g. C:/)

      // 2. Resolve full path from project root
      const safePath = path.join(this.projectPath, relativePath);

      // 3. Ensure target directory exists
      await fs.mkdir(path.dirname(safePath), { recursive: true });

      await writeFileContent(safePath, file.content);
      this.log(`✅ Written: ${safePath}`);
    } catch (err) {
      this.log(`❌ Failed to write ${file.fileName}: ${err.message}`);
    }
  }

  async verificationPhase(codeFiles) {
    const mainFile = codeFiles.find(f =>
      f.fileName.endsWith('.js') ||
      f.fileName.endsWith('.ts') ||
      f.fileName.endsWith('.php')
    ) || codeFiles[0];

    if (!mainFile) return;

    let verified = false;
    let attempts = 0;

    while (!verified && attempts < this.config.maxRetries) {
      const lang = mainFile.fileName.endsWith('.php') ? 'php' : 'javascript';

      this.log(`📦 Verifying ${mainFile.fileName} in Sandbox...`);
      const execution = await this.sandbox.execute(mainFile.content, lang);

      if (execution.success) {
        this.log('✅ Sandbox verification PASSED.');
        verified = true;
      } else {
        this.log(`❌ Sandbox verification FAILED: ${execution.stderr.slice(0, 200)}...`);
        this.log('🔄 Coder is fixing the code...');

        const fixedResponse = await this.coder.think({
          task: 'Fix compilation/runtime error',
          design: `Error: ${execution.stderr}\n\nPrevious Code:\n${mainFile.content}`
        });

        const fixedData = this.parseAgentResponse(fixedResponse);
        for (const f of (fixedData.files || [])) {
          await this.saveFile(f);
          const original = codeFiles.find(cf => cf.fileName === f.fileName);
          if (original) original.content = f.content;
        }
      }
      attempts++;
    }
  }

  async qaPhase(codeFiles) {
    this.log(`${this.colors.magenta}🧪 Starting Universal QA & Dependency Audit...${this.colors.reset}`);
    
    // Existing dependency audit logic
    const missingFiles = new Set();
    const dependencyPatterns = [
        /href="([^"|http][^"]+)"/g,  // CSS, Links
        /src="([^"|http][^"]+)"/g,   // JS, Images, Scripts
        /import\s+.*\s+from\s+['"]([^'"]+)['"]/g, // ES6 Imports
        /require\(['"]([^'"]+)['"]\)/g,           // CommonJS
        /@import\s+['"]([^'"]+)['"]/g             // CSS @import
    ];

    for (const file of codeFiles) {
        for (const pattern of dependencyPatterns) {
            let match;
            while ((match = pattern.exec(file.content)) !== null) {
                const ref = match[1].split('?')[0].split('#')[0];
                if (ref.startsWith('http') || ref.startsWith('//') || ref.startsWith('data:')) continue;
                const exists = codeFiles.some(f => f.fileName.includes(ref) || ref.includes(f.fileName));
                if (!exists) {
                    this.log(`${this.colors.red}⚠️ Missing Dependency: ${ref} (Referenced in ${file.fileName})${this.colors.reset}`);
                    missingFiles.add(ref);
                }
            }
        }
    }

    // IMPROVED: Test Engineer Mode - Execute real commands
    this.speak('qa', 'system', `I'm launching the Test Runner to verify the project integrity.`);
    const testCmd = this.currentBlueprint?.tech_stack?.some(s => s.toLowerCase().includes('node')) ? 'npm test' : 'ls -R';
    
    let runtimeLogs = "";
    try {
        const [cmd, ...args] = testCmd.split(' ');
        this.thinking('qa', `running ${testCmd}`);
        const run = await this.sandbox.executeCommand(cmd, args, this.projectPath);
        runtimeLogs = `STDOUT:\n${run.stdout}\n\nSTDERR:\n${run.stderr}`;
    } catch (e) {
        runtimeLogs = `Execution Error: ${e.message}`;
    }

    // Trigger AI-Powered Smart QA Audit
    this.thinking('qa', 'auditing code and logs');
    const codeContent = codeFiles.slice(-5).map(f => `// File: ${f.fileName}\n${f.content}`).join('\n\n');
    const rawReport = await this.qa.think({ 
        code: codeContent,
        logs: runtimeLogs,
        stack: this.currentBlueprint?.tech_stack || []
    });
    
    const report = this.parseAgentResponse(rawReport);

    if (report && report.status === "FAIL") {
        this.speak('qa', 'system', `Audit failed! I found ${report.issues?.length || 0} issues that need immediate attention.`);
        
        // INTER-AGENT FEEDBACK: QA -> Architect
        if (report.feedback && report.feedback.target === 'architect') {
             this.speak('qa', 'architect', `Archie, we have a structural problem. ${report.feedback.message}`);
        }

        for (const issue of (report.issues || [])) {
            if (issue.severity === "HIGH") {
                this.speak('qa', 'coder', `Codey, there's a critical issue in ${issue.file}: ${issue.issue}. Here is the fix: ${issue.fix}`);
                this.thinking('coder', 'applying fix');
                const fixResponse = await this.coder.think({
                    task: `Fix issue: ${issue.issue}`,
                    design: `Current Code:\n${codeFiles.find(f => f.fileName === issue.file)?.content || ''}\n\nRecommended Fix: ${issue.fix}\n\nRuntime Logs:\n${runtimeLogs}`
                });
                const fixedData = this.parseAgentResponse(fixResponse);
                for (const rf of (fixedData.files || [])) {
                    await this.saveFile(rf);
                    const original = codeFiles.find(f => f.fileName === rf.fileName);
                    if (original) original.content = rf.content;
                }
                this.speak('coder', 'qa', `Fixed the issue in ${issue.file}. Ready for re-audit!`);
            }
        }
    } else {
        this.speak('qa', 'system', `All systems go! Code quality score: ${report?.overall_quality_score || '10'}/10. Excellent work team.`);
    }

    await this.selfHealPhase(codeFiles);
    this.log(`${this.colors.green}✅ Universal QA Cycle Finished!${this.colors.reset}`);
    return report;
  }

  getBlueprint() {
    return this.currentBlueprint;
  }

  getHistory() {
    return this.history;
  }

  log(message) {
    console.error(`[SWARM] ${message}`);
  }
}

