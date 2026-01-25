import { ArchitectAgent, CoderAgent, QAAgent } from './agents.js';
import { SandboxManager } from '../../sandbox/index.js';
import { extractCodeFromResponse, writeFileContent } from '../../helpers/index.js';
import path from 'path';

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
    let coderResponse = await this.coder.think({ task, design });
    let codeFiles = [];

    // Parse JSON
    try {
        const jsonMatch = coderResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            codeFiles = JSON.parse(jsonMatch[0]);
        } else {
             // Fallback if model fails to output JSON (simplified)
            codeFiles = [{ fileName: 'output.js', content: coderResponse }];
        }
    } catch (e) {
        this.log(`⚠️ Failed to parse coder JSON: ${e.message}`);
    }

    // Save Files to Disk
    this.log(`💾 Saving ${codeFiles.length} generated files...`);
    for (const file of codeFiles) {
        try {
            // Ensure path is sanitized
            const safePath = path.isAbsolute(file.fileName) 
                ? file.fileName 
                : path.join(this.projectPath, file.fileName);
            
            await writeFileContent(safePath, file.content);
            this.log(`✅ Written: ${file.fileName}`);
        } catch (err) {
            this.log(`❌ Failed to write ${file.fileName}: ${err.message}`);
        }
    }

    // Attempt verification loop (max 3 retries)
    // For now, we verify the primary/first file logic or script if applicable
    // In a real system, we would run a proper test suite.
    // Here we maintain the sandbox check for the "main" file logic if it looks executable.
    
    let mainFile = codeFiles.find(f => f.fileName.endsWith('.js') || f.fileName.endsWith('.ts') || f.fileName.endsWith('.php')) || codeFiles[0];
    
    if (mainFile) {
        let verified = false;
        let attempts = 0;
        
        while (!verified && attempts < 3) {
            const lang = mainFile.fileName.endsWith('.php') ? 'php' : 'javascript';
            
            this.log(`📦 Verifying ${mainFile.fileName} in Sandbox...`);
            const execution = await this.sandbox.execute(mainFile.content, lang);
            
            if (execution.success) {
                this.log('✅ Sandbox verification PASSED.');
                verified = true;
            } else {
                this.log(`❌ Sandbox verification FAILED: ${execution.stderr.slice(0, 200)}...`);
                this.log('🔄 Coder is fixing the code...');
                
                const fixPrompt = `The previous code failed to execute/compile in the sandbox.
Error: ${execution.stderr}

Fix the code and return the complete corrected version as a JSON array (same format).
Previous Code (Main File):
${mainFile.content}`;

                // Ask Coder to fix
                const fixedResponse = await this.coder.think({ task: "Fix compilation/runtime error", design: fixPrompt });
                
                // Parse fixed JSON
                try {
                    const jsonMatch = fixedResponse.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const fixedFiles = JSON.parse(jsonMatch[0]);
                        
                        // Overwrite files
                        for (const f of fixedFiles) {
                             const safePath = path.isAbsolute(f.fileName) ? f.fileName : path.join(this.projectPath, f.fileName);
                             await writeFileContent(safePath, f.content);
                             
                             // Update local state for next loop verification
                             const originalFile = codeFiles.find(cf => cf.fileName === f.fileName);
                             if (originalFile) originalFile.content = f.content;
                        }
                        
                        // Update mainFile reference for next loop
                        mainFile = codeFiles.find(f => f.fileName === mainFile.fileName) || mainFile;
                    }
                } catch (e) {
                    this.log(`⚠️ Failed to parse fixed code: ${e.message}`);
                }
            }
             attempts++;
        }
    }
    
    this.history.push({ role: 'coder', content: JSON.stringify(codeFiles) });

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
