import { callGLM, extractCodeFromResponse, robustJSONParse } from '../../helpers/index.js';
import {
  createEmptyBlueprint,
  validateBlueprint,
  mergeBlueprints
} from '../../types/blueprint.js';
import {
  generateERDiagram,
  generateFlowchart,
  generateComponentTree,
  generateArchitectureDiagram,
  generateEndpointDiagram
} from '../../types/mermaid.js';
import {
  buildArchitectPrompt,
  buildLayerPrompt,
  buildMergePrompt,
  ARCHITECT_SYSTEM_PROMPT
} from './prompts.js';
import fs from 'fs/promises';
import path from 'path';

export class ArchitectAgent {
  constructor(config = {}) {
    this.name = 'Archie';
    this.role = 'architect';
    this.config = {
      useLayeredAnalysis: true,
      autoSaveArchitectureDoc: true,
      defaultTechStack: ['Next.js', 'Prisma', 'PostgreSQL', 'Tailwind CSS'],
      ...config
    };
    this.memory = [];
    this.currentBlueprint = null;
  }

  async generateBlueprint(userTask, projectContext = {}) {
    this.log('📐 Starting architectural design...');

    let blueprint;

    if (this.config.useLayeredAnalysis) {
      blueprint = await this.layeredAnalysis(userTask, projectContext);
    } else {
      blueprint = await this.singlePassAnalysis(userTask, projectContext);
    }

    const validation = validateBlueprint(blueprint);
    if (!validation.valid) {
      this.log(`⚠️ Blueprint validation warnings: ${validation.errors.join(', ')}`);
      blueprint = this.fixBlueprint(blueprint, validation.errors);
    }

    this.currentBlueprint = blueprint;
    this.memory.push({ type: 'blueprint', data: blueprint, timestamp: new Date().toISOString() });

    if (this.config.autoSaveArchitectureDoc && projectContext.projectPath) {
      await this.saveArchitectureDoc(blueprint, projectContext.projectPath);
    }

    this.log('✅ Blueprint created!');
    return blueprint;
  }

  async runShardedAnalysis(task) {
    this.log(`I'm initiating a multi-layered sharded analysis. This ensures every edge case is considered.`);
    
    // Step 1: Rapid Component Inventory (File Tree)
    const inventory = await this.generateComponentInventory(task);
    this.log(`Strategic scan complete! I've identified ${inventory.files ? inventory.files.length : 0} distinct components for this build.`);

    const projectName = this.extractProjectName(task) || 'Sharded Project';
    const shardedBlueprint = createEmptyBlueprint(projectName);
    shardedBlueprint.architecture = inventory.architecture || shardedBlueprint.architecture;
    shardedBlueprint.tech_stack = inventory.tech_stack || inventory.architecture?.tech_stack || this.config.defaultTechStack;
    shardedBlueprint.execution_steps = [];

    // Step 2: Micro-Design for EACH component separately
    if (inventory.files && Array.isArray(inventory.files)) {
      this.log(`I'm now deep-diving into the individual logic of each component. This will be a precision-sharded build.`);
      for (let i = 0; i < inventory.files.length; i++) {
          const file = inventory.files[i];
          this.log(`[${i+1}/${inventory.files.length}] Designing logic for: ${file.path}. I'm defining its specific functions, state handling, and UI details.`);
          
          const componentPlan = await this.designSingleComponent(file, task, inventory.architecture);
          shardedBlueprint.execution_steps.push({
              name: `Design & Implement: ${file.path}`,
              tasks: [componentPlan.prompt]
          });
      }
    }

    return shardedBlueprint;
  }

  async generateComponentInventory(task) {
    const prompt = `Persona: Principal Systems Architect
Task: Analyze this request and design a universal file inventory: "${task}"

STRICT CONSTRAINTS:
1. Identify the PRIMARY LANGUAGE and FRAMEWORKS required (e.g. Rust, Go, Python/Django, Vue.js, etc.).
2. Design a professional directory structure and file set.
3. For UI tasks, ensure "Premium, Modern, Neon/Cyberpunk" aesthetics are specified.

Return ONLY a raw JSON object:
{
  "tech_stack": ["Language", "Framework1", "LibraryX"],
  "architecture": "Clean/Layered/Modular description",
  "files": [
    { "path": "string", "purpose": "string" }
  ]
}`;
    const response = await this.askLLM(prompt);
    
    // Use the robust parser instead of direct JSON.parse
    const parsed = this.parseJSONResponse(response, 'full');
    if (!parsed || !parsed.files) {
        console.error("🔴 [ARCHITECT] Component Inventory Parse FAILURE.");
        console.error("RAW RESPONSE FROM LLM:", response);
        throw new Error("Failed to parse component inventory JSON from LLM response.");
    }
    return parsed;
  }

  async designSingleComponent(file, originalTask, globalContext) {
    const prompt = `Persona: Senior Solutions Architect
Task: Design the implementation strategy for the file: ${file.path}.
Purpose: ${file.purpose}.
Global Context: ${originalTask}.
Tech Stack: ${JSON.stringify(globalContext)}.

STRICT INSTRUCTIONS:
1. Provide DETAILED technical instructions. No "concise" notes.
2. Specify exact CSS animations, keyframes, and color tokens (Neon/Cyberpunk theme).
3. Define the internal logic (State handling, event listeners, API interactions).
4. Ensure the output follows SOLID and DRY principles.
5. If it's a UI component, describe the "Premium UX" details (Transitions, hover effects).

Return ONLY the technical instruction set for the Coder.`;
    const response = await this.askLLM(prompt);
    return { path: file.path, prompt: response };
  }

  async askLLM(prompt) {
    return await callGLM(prompt);
  }

  async layeredAnalysis(userTask, projectContext) {
    this.log('🔍 Running layered analysis...');

    this.log('  📊 Data layer analysis...');
    const dataLayerPrompt = buildLayerPrompt('data', userTask);
    const dataLayerResponse = await callGLM(dataLayerPrompt);
    const dataLayer = this.parseJSONResponse(dataLayerResponse, 'database');

    this.log('  ⚙️ Logic layer analysis...');
    const logicLayerPrompt = buildLayerPrompt('logic', userTask, { database: dataLayer });
    const logicLayerResponse = await callGLM(logicLayerPrompt);
    const logicLayer = this.parseJSONResponse(logicLayerResponse, 'backend');

    this.log('  🖼️ Presentation layer analysis...');
    const presentationLayerPrompt = buildLayerPrompt('presentation', userTask, {
      database: dataLayer,
      backend: logicLayer
    });
    const presentationLayerResponse = await callGLM(presentationLayerPrompt);
    const presentationLayer = this.parseJSONResponse(presentationLayerResponse, 'frontend');

    const safeTask = (userTask && typeof userTask === 'string') ? userTask : 'New Project';
    const projectName = this.extractProjectName(safeTask) || 'New Project';
    
    let blueprint = null;
    try {
      const mergePrompt = buildMergePrompt(dataLayer, logicLayer, presentationLayer, projectName);
      const mergedResponse = await callGLM(mergePrompt);
      blueprint = this.parseJSONResponse(mergedResponse, 'full');
    } catch (e) {
      this.log(`⚠️ Merge phase failed or timed out: ${e.message}. Using fallback synthesis.`);
    }

    // ROBUST FALLBACK: If merge failed, synthesize from individual layers
    if (!blueprint || !blueprint.project_name) {
      this.log('🛠️ Synthesizing blueprint from analyzed layers...');
      blueprint = createEmptyBlueprint(projectName);
      blueprint.architecture = {
        database: dataLayer || { tables: [] },
        backend: logicLayer || { services: [], endpoints: [] },
        frontend: presentationLayer || { component_tree: [], routes: [] }
      };
      
      // Auto-populate tech stack from project context or defaults
      blueprint.tech_stack = projectContext.techStack || this.config.defaultTechStack;
      
      // Ensure we have at least basic execution steps
      blueprint.execution_steps = this.generateDefaultSteps(blueprint);
    }

    return blueprint;
  }

  async singlePassAnalysis(userTask, projectContext) {
    this.log('🎯 Running single-pass analysis...');

    const prompt = buildArchitectPrompt(userTask, JSON.stringify(projectContext));
    const response = await callGLM(prompt);

    let blueprint = this.parseJSONResponse(response, 'full');

    if (!blueprint || !blueprint.project_name) {
      const projectName = this.extractProjectName(userTask) || 'New Project';
      blueprint = createEmptyBlueprint(projectName);
      blueprint.tech_stack = this.config.defaultTechStack;
    }

    return blueprint;
  }

  parseJSONResponse(response, expectedType = 'full') {
    const parsed = robustJSONParse(response);
    if (parsed) {
      if (expectedType === 'database' && parsed.database) return parsed.database;
      if (expectedType === 'backend' && parsed.backend) return parsed.backend;
      if (expectedType === 'frontend' && parsed.frontend) return parsed.frontend;
      return parsed;
    }
    
    // Fallback for empty structures if parsing failed but expectedType implies specific part
    if (expectedType === 'database') return { tables: [] };
    if (expectedType === 'backend') return { services: [], endpoints: [] };
    if (expectedType === 'frontend') return { component_tree: [], routes: [] };
    
    return null;
  }

  extractProjectName(task) {
    const patterns = [
      /(?:create|build|make|develop|yap|oluştur)\s+(?:a\s+)?(.+?)(?:\s+(?:system|app|application|platform|site|website|proje|uygulama))/i,
      /(.+?)\s+(?:system|app|application|platform|site|website|projesi|uygulaması)/i
    ];

    for (const pattern of patterns) {
      const match = (task && typeof task === 'string') ? task.match(pattern) : null;
      if (match) {
        return match[1].trim().replace(/^(bir|an?)\s+/i, '');
      }
    }

    return null;
  }

  generateDefaultSteps(blueprint) {
    const steps = [];

    if (blueprint.architecture.database?.tables?.length > 0) {
      steps.push('1. Create and migrate database schema');
      steps.push('2. Add seed data (if needed)');
    }

    if (blueprint.architecture.backend?.services?.length > 0) {
      steps.push(`${steps.length + 1}. Implement backend services`);
    }

    if (blueprint.architecture.backend?.endpoints?.length > 0) {
      steps.push(`${steps.length + 1}. Create API endpoints`);
    }

    if (blueprint.architecture.frontend?.component_tree?.length > 0) {
      steps.push(`${steps.length + 1}. Create UI components`);
      steps.push(`${steps.length + 1}. Set up pages and routing`);
    }

    steps.push(`${steps.length + 1}. State management integration`);
    steps.push(`${steps.length + 1}. Testing and validation`);

    return steps;
  }

  fixBlueprint(blueprint, errors) {
    const fixed = { ...blueprint };

    // Ensure project_name is a string
    if (!fixed.project_name || typeof fixed.project_name !== 'string') {
      fixed.project_name = this.extractProjectName(JSON.stringify(blueprint)) || 'Untitled Project';
    }

    // Ensure tech_stack is an array
    if (!Array.isArray(fixed.tech_stack)) {
      // If it's a string, try to split it or make it a single-item array
      if (typeof fixed.tech_stack === 'string') {
        fixed.tech_stack = fixed.tech_stack.split(',').map(s => s.trim());
      } else {
        fixed.tech_stack = this.config.defaultTechStack;
      }
    }

    // Ensure architecture is an object
    if (!fixed.architecture || typeof fixed.architecture !== 'object' || Array.isArray(fixed.architecture)) {
      fixed.architecture = createEmptyBlueprint().architecture;
    }

    // Ensure execution_steps is an array and contains strings
    if (!Array.isArray(fixed.execution_steps)) {
      if (typeof fixed.execution_steps === 'string') {
        fixed.execution_steps = fixed.execution_steps.split('\n').filter(s => s.trim().length > 0);
      } else {
        fixed.execution_steps = this.generateDefaultSteps(fixed);
      }
    }

    // Double check each step is a string
    fixed.execution_steps = (fixed.execution_steps || []).map(s => 
      (s && typeof s === 'string') ? s : (typeof s === 'object' ? JSON.stringify(s) : String(s))
    );

    // Fallback if still empty after fix attempts
    if (fixed.execution_steps.length === 0) {
      fixed.execution_steps = this.generateDefaultSteps(fixed);
    }

    return fixed;
  }

  async saveArchitectureDoc(blueprint, projectPath) {
    const doc = this.generateArchitectureMarkdown(blueprint);
    const docPath = path.join(projectPath, 'ARCHITECTURE.md');

    try {
      await fs.writeFile(docPath, doc, 'utf-8');
      this.log(`📄 ARCHITECTURE.md saved: ${docPath}`);
    } catch (error) {
      this.log(`❌ ARCHITECTURE.md save error: ${error.message}`);
    }
  }

  generateArchitectureMarkdown(blueprint) {
    const { project_name, tech_stack, architecture, execution_steps, metadata } = blueprint;
    const safeTechStack = Array.isArray(tech_stack) ? tech_stack : [];

    let doc = `# ${project_name} - Architecture Documentation

> Created: ${metadata?.created_at || new Date().toISOString()}
> Version: ${metadata?.version || '1.0.0'}

## Tech Stack

${safeTechStack.map(t => `- ${t}`).join('\n')}

---

## Overall Architecture

${generateArchitectureDiagram(blueprint)}

---

## 1. Database Schema

### ER Diagram

${generateERDiagram(architecture.database?.tables || [])}

### Tables

`;

    if (architecture.database?.tables) {
      for (const table of architecture.database.tables) {
        doc += `#### ${table.name || 'Unnamed Table'}\n`;
        doc += `- **Columns**: ${table.columns?.join(', ') || 'N/A'}\n`;
        doc += `- **Relations**: ${table.relations?.join(', ') || 'N/A'}\n`;
        doc += `- **Indexes**: ${table.indexes?.join(', ') || 'N/A'}\n\n`;
      }
    }

    doc += `---

## 2. Backend API

### Endpoint Map

${generateEndpointDiagram(architecture.backend?.endpoints || [])}

### Services

`;

    if (architecture.backend?.services) {
      for (const svc of architecture.backend.services) {
        doc += `#### ${svc.name || 'Unnamed Service'}\n`;
        doc += `- **Responsibility**: ${svc.responsibility || 'N/A'}\n`;
        doc += `- **Dependencies**: ${svc.dependencies?.join(', ') || 'None'}\n\n`;
      }
    }

    doc += `---

## 3. Frontend Structure

### Component Tree

${generateComponentTree(architecture.frontend?.component_tree || [])}

### Routes

`;

    if (architecture.frontend?.routes) {
      doc += `| Path | Component | Auth Required |\n`;
      doc += `|------|-----------|---------------|\n`;
      for (const route of architecture.frontend.routes) {
        doc += `| ${route.path || '/'} | ${route.component || 'Unknown'} | ${route.auth ? '✅' : '❌'} |\n`;
      }
    }

    const safeSteps = execution_steps || [];

    doc += `

---

## 4. Execution Steps

${generateFlowchart(safeSteps)}

### Step List

${safeSteps.map((step, i) => {
  const stepText = (typeof step === 'string') ? step : String(step);
  return `${i + 1}. ${stepText.replace(/^\d+\.\s*/, '')}`;
}).join('\n')}

---

*This document was automatically generated by Architect Agent.*
`;

    return doc;
  }

  getBlueprint() {
    return this.currentBlueprint;
  }

  getBlueprintSummary() {
    if (!this.currentBlueprint) return null;

    const { project_name, tech_stack, architecture, execution_steps } = this.currentBlueprint;

    return {
      name: project_name,
      stack: tech_stack.join(', '),
      tables: architecture.database?.tables?.length || 0,
      endpoints: architecture.backend?.endpoints?.length || 0,
      components: architecture.frontend?.component_tree?.length || 0,
      steps: execution_steps.length
    };
  }

  log(message) {
    console.error(`\n\x1b[36m\x1b[1m📐 Archie:\x1b[0m \x1b[3m"${message}"\x1b[0m`);
  }
}

export async function createArchitect(config = {}) {
  return new ArchitectAgent(config);
}
