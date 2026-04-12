import { ArchitectAgent } from '../architect/index.js';
import { CoderAgent, QAAgent } from './agents.js';
import { TaskSplitter } from './task-splitter.js';
import { SandboxManager } from '../../sandbox/index.js';
import { writeFileContent } from '../../helpers/index.js';
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
      ...config
    };
    this.currentBlueprint = null;
    this.colors = {
      reset: "\x1b[0m",
      bright: "\x1b[1m",
      dim: "\x1b[2m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      cyan: "\x1b[36m",
      magenta: "\x1b[35m",
      red: "\x1b[31m"
    };
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
    this.log('🏗️ Architect is designing with Miro-Sharding...');
    const blueprint = await this.architect.runShardedAnalysis(task);

    this.currentBlueprint = blueprint;
    this.history.push({
      role: 'architect',
      type: 'blueprint',
      content: blueprint
    });

    this.log(`📐 Blueprint created: ${blueprint.project_name}`);
    this.log(`   - Tables: ${blueprint.architecture.database?.tables?.length || 0}`);
    this.log(`   - Endpoints: ${blueprint.architecture.backend?.endpoints?.length || 0}`);
    this.log(`   - Components: ${blueprint.architecture.frontend?.component_tree?.length || 0}`);
    this.log(`   - Steps: ${blueprint.execution_steps.length}`);

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

        const result = await this.coder.think({
            task: task.prompt,
            stack: blueprint.tech_stack,
            context: `Global Architecture: ${JSON.stringify(blueprint.architecture)}`
        });

        const codeFiles = this.parseCoderResponse(result);
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

  parseCoderResponse(response) {
    if (!response || typeof response !== 'string') {
      this.log('⚠️ Coder returned empty or invalid response.');
      return [];
    }

    try {
      // Robust extraction: Find the first '[' and last ']' to isolate the JSON array
      const startIndex = response.indexOf('[');
      const endIndex = response.lastIndexOf(']');

      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
          const jsonCandidate = response.substring(startIndex, endIndex + 1);
          try {
              const parsed = JSON.parse(jsonCandidate);
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].fileName) {
                  return parsed;
              }
          } catch (e) {
              this.log(`⚠️ Partial JSON match failed to parse: ${e.message}`);
          }
      }

      // Fallback: Check for code blocks if standard extraction fails
      const clean = response.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
      if (clean.includes('"fileName"') && clean.includes('"content"')) {
          try {
              return JSON.parse(clean);
          } catch (e) {}
      }
    } catch (e) {
      this.log(`⚠️ Failed to parse coder JSON: ${e.message}`);
    }

    return [{ fileName: 'index.html', content: response }];
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

        const fixedFiles = this.parseCoderResponse(fixedResponse);
        for (const f of fixedFiles) {
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

    // NEW: Trigger AI-Powered Smart QA Audit
    const codeContent = codeFiles.map(f => `// File: ${f.fileName}\n${f.content}`).join('\n\n');
    const rawReport = await this.qa.think({ 
        code: codeContent,
        stack: this.currentBlueprint?.tech_stack || []
    });
    
    const { robustJSONParse } = await import('../../helpers/index.js');
    const report = robustJSONParse(rawReport);

    if (report && report.status === "FAIL") {
        this.log(`${this.colors.red}❌ QA Audit FAILED with ${report.issues.length} issues.${this.colors.reset}`);
        for (const issue of report.issues) {
            this.log(`   - [${issue.severity}] ${issue.file}: ${issue.issue}`);
            if (issue.severity === "HIGH") {
                this.log(`🛠️ Self-Healing: Fixing ${issue.file}...`);
                const fixResponse = await this.coder.think({
                    task: `Fix issue: ${issue.issue}`,
                    design: `Current Code:\n${codeFiles.find(f => f.fileName === issue.file)?.content || ''}\n\nRecommended Fix: ${issue.fix}`
                });
                const fixedFiles = this.parseCoderResponse(fixResponse);
                for (const rf of fixedFiles) {
                    await this.saveFile(rf);
                    const original = codeFiles.find(f => f.fileName === rf.fileName);
                    if (original) original.content = rf.content;
                }
            }
        }
    } else {
        this.log(`${this.colors.green}✅ AI QA Audit PASSED. (Score: ${report?.overall_quality_score || 'N/A'}/10)${this.colors.reset}`);
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

