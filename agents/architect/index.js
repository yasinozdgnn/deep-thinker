import { callGLM, extractCodeFromResponse } from '../../helpers/index.js';
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

    const projectName = this.extractProjectName(userTask) || 'New Project';
    const mergePrompt = buildMergePrompt(dataLayer, logicLayer, presentationLayer, projectName);
    const mergedResponse = await callGLM(mergePrompt);
    
    let blueprint = this.parseJSONResponse(mergedResponse, 'full');
    
    if (!blueprint || !blueprint.project_name) {
      blueprint = createEmptyBlueprint(projectName);
      blueprint.architecture.database = dataLayer;
      blueprint.architecture.backend = logicLayer;
      blueprint.architecture.frontend = presentationLayer;
      blueprint.tech_stack = this.config.defaultTechStack;
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
    try {
      // First try standard extraction (handles markdown code blocks)
      const extracted = extractCodeFromResponse(response);

      if (extracted) {
        try {
          const parsed = JSON.parse(extracted);
           if (expectedType === 'database' && parsed.database) return parsed.database;
           if (expectedType === 'backend' && parsed.backend) return parsed.backend;
           if (expectedType === 'frontend' && parsed.frontend) return parsed.frontend;
           return parsed;
        } catch (e) {
             // Continue to fallback
        }
      }

      // Fallback: Regex matching
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        if (expectedType === 'database' && parsed.database) return parsed.database;
        if (expectedType === 'backend' && parsed.backend) return parsed.backend;
        if (expectedType === 'frontend' && parsed.frontend) return parsed.frontend;

        return parsed;
      }
    } catch (e) {
      this.log(`⚠️ JSON parse error: ${e.message}`);
      // Return empty structures if parsing failed but expectedType implies specific part
      if (expectedType === 'database') return { tables: [] };
      if (expectedType === 'backend') return { services: [], endpoints: [] };
      if (expectedType === 'frontend') return { component_tree: [], routes: [] };
    }
    return null;
  }

  extractProjectName(task) {
    const patterns = [
      /(?:create|build|make|develop|yap|oluştur)\s+(?:a\s+)?(.+?)(?:\s+(?:system|app|application|platform|site|website|proje|uygulama))/i,
      /(.+?)\s+(?:system|app|application|platform|site|website|projesi|uygulaması)/i
    ];

    for (const pattern of patterns) {
      const match = task.match(pattern);
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

    for (const error of errors) {
      if (error.includes('project_name')) {
        fixed.project_name = fixed.project_name || 'Untitled Project';
      }
      if (error.includes('tech_stack')) {
        fixed.tech_stack = fixed.tech_stack || this.config.defaultTechStack;
      }
      if (error.includes('architecture')) {
        fixed.architecture = fixed.architecture || createEmptyBlueprint().architecture;
      }
      if (error.includes('execution_steps')) {
        fixed.execution_steps = fixed.execution_steps || this.generateDefaultSteps(fixed);
      }
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

${safeSteps.map((step, i) => `${i + 1}. ${step.replace(/^\d+\.\s*/, '')}`).join('\n')}

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
    console.error(`[ARCHITECT] ${message}`);
  }
}

export async function createArchitect(config = {}) {
  return new ArchitectAgent(config);
}
