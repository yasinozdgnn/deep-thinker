import { ArchitectAgent } from '../architect/index.js';
import { CoderAgent, QAAgent } from './agents.js';
import { SandboxManager } from '../../sandbox/index.js';
import { writeFileContent } from '../../helpers/index.js';
import path from 'path';

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
  }

  async runSwarm(task) {
    this.log('🚀 Swarm started for task: ' + task);

    const blueprint = await this.architectPhase(task);
    
    if (this.config.requireApproval) {
      this.log('⏳ Waiting for approval...');
    }

    const codeFiles = await this.coderPhase(blueprint);
    
    await this.verificationPhase(codeFiles);
    
    const testReport = await this.qaPhase(codeFiles);

    this.log('✅ Swarm finished.');

    return {
      blueprint,
      codeFiles,
      testReport,
      summary: 'Swarm completed all phases with Blueprint-driven architecture.'
    };
  }

  async architectPhase(task) {
    this.log('🏗️ Architect is designing with Blueprint...');
    
    const blueprint = await this.architect.generateBlueprint(task, {
      projectPath: this.projectPath
    });
    
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

  async coderPhase(blueprint) {
    this.log('👨‍💻 Coder is implementing based on Blueprint...');
    
    const allCodeFiles = [];
    
    const steps = blueprint.execution_steps || [];
    if (steps.length === 0) {
      this.log('⚠️ No execution steps found in blueprint. Skipping coding phase.');
      return [];
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.log(`📝 Step ${i + 1}/${steps.length}: ${step}`);
      
      const stepContext = this.getStepContext(step, blueprint);
      const coderResponse = await this.coder.think({ 
        task: step, 
        design: JSON.stringify(stepContext, null, 2)
      });
      
      const codeFiles = this.parseCoderResponse(coderResponse);
      
      for (const file of codeFiles) {
        await this.saveFile(file);
        allCodeFiles.push(file);
      }
    }
    
    this.history.push({ 
      role: 'coder', 
      type: 'implementation',
      content: allCodeFiles 
    });

    return allCodeFiles;
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
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      this.log(`⚠️ Failed to parse coder JSON: ${e.message}`);
    }
    
    return [{ fileName: 'output.js', content: response }];
  }

  async saveFile(file) {
    try {
      const safePath = path.isAbsolute(file.fileName) 
        ? file.fileName 
        : path.join(this.projectPath, file.fileName);
      
      await writeFileContent(safePath, file.content);
      this.log(`✅ Written: ${file.fileName}`);
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
    this.log('🧪 QA is verifying...');
    
    const codeContent = codeFiles.map(f => 
      `// ${f.fileName}\n${f.content}`
    ).join('\n\n');
    
    const testReport = await this.qa.think({ code: codeContent });
    this.history.push({ role: 'qa', content: testReport });
    
    return testReport;
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

