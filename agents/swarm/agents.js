import { callAI } from '../../helpers/index.js';
import { CODE_QUALITY_REQUIREMENTS, PREMIUM_UI_GUIDELINES, getFrameworkRules } from '../../prompts/index.js';

export class BaseAgent {
  constructor(name, role, config = {}) {
    this.name = name;
    this.role = role;
    this.config = config;
    this.memory = [];
  }

  async think(context) {
    const prompt = this.buildPrompt(context);
    const response = await callAI(prompt);
    return response;
  }

  buildPrompt(context) {
    return `You are ${this.name}, a ${this.role}.\nContext: ${JSON.stringify(context)}`;
  }

  log(message) {
    console.error(`[${this.role.toUpperCase()}] ${this.name}: ${message}`);
  }
}

export class ArchitectAgent extends BaseAgent {
  constructor() {
    super('Archie', 'architect');
  }

  buildPrompt(context) {
    return `You are a Senior Software Architect.
Your goal is to design a robust, scalable solution for the given task.
Do NOT write implementation code. Focus on:
- Component structure
- Data flow
- Interface definitions
- Technology choices

Task: ${context.task}
Project Context: ${context.projectContext}

Output a detailed design document (Markdown).`;
  }
}

export class CoderAgent extends BaseAgent {
  constructor() {
    super('Codey', 'coder');
  }

  buildPrompt(context) {
    const stackRules = getFrameworkRules(context.stack || []);
    
    return `Persona: Principal Software Engineer
Goal: Implement the technical blueprint with Zero-Bug/Production-Grade quality.

${CODE_QUALITY_REQUIREMENTS}

${PREMIUM_UI_GUIDELINES}

${stackRules}

Task: ${context.task}
Architect's Design: ${context.design}
${context.uiDesign ? `\n🎨 UI Design Spec:\n${typeof context.uiDesign === 'string' ? context.uiDesign : JSON.stringify(context.uiDesign, null, 2).slice(0, 3000)}` : ''}
${context.backendDesign ? `\n🗄️ Backend Design Spec:\n${typeof context.backendDesign === 'string' ? context.backendDesign : JSON.stringify(context.backendDesign, null, 2).slice(0, 3000)}` : ''}

CRITICAL: If you find a fundamental logic flaw, missing requirement, or impossible constraint in the Architect's design, you MUST provide feedback.

OUTPUT FORMAT (Strict JSON Object):
{
  "files": [
    { "fileName": "path/file.ext", "content": "code..." }
  ],
  "feedback": {
    "target": "architect",
    "issue": "Specific logic flaw found in the blueprint",
    "required_change": "What the architect needs to fix"
  }
}

Note: If no feedback is needed, set 'feedback' to null. Return ONLY the raw JSON object.`;
  }
}

export class QAAgent extends BaseAgent {
  constructor() {
    super('Tester', 'qa_engineer');
  }

  buildPrompt(context) {
    const stackRules = getFrameworkRules(context.stack || []);

    return `Persona: Senior QA Auditor & Runtime Analyst
Goal: Verify code integrity through static analysis AND runtime log evaluation.

${stackRules}

Verification Context:
- Code: ${context.code}
- Runtime Logs (stdout/stderr): ${context.logs || "No logs available yet."}

AUDIT RULES:
1. SOURCING: If runtime logs show a crash, identify the exact line.
2. FEEDBACK: If the error is due to a bad architectural decision (e.g. wrong port, missing env, bad schema), send feedback to the Architect.
3. REPAIR: If it's a coding bug, provide a fix for the Coder.

OUTPUT FORMAT (Strict JSON Object):
{
  "status": "PASS" | "FAIL",
  "feedback": { "target": "architect" | "coder", "message": "reasoning" },
  "issues": [
    { "file": "string", "issue": "string", "severity": "HIGH", "fix": "string" }
  ],
  "overall_quality_score": 1-10
}

Return ONLY the raw JSON object.`;
  }
}

/**
 * 🎨 UI/UX Designer Agent
 * Mevcut projede varsa tasarım diline uygun, yoksa modern/şık tasarımlar üretir.
 */
export class UIDesignerAgent extends BaseAgent {
  constructor() {
    super('UIna', 'ui_designer');
  }

  buildPrompt(context) {
    const { task, architecture, existingUI } = context;

    let designDirective = existingUI
      ? `IMPORTANT: This project already has existing UI patterns. Analyze and MATCH the established design language below:\n${existingUI}`
      : `Design a MODERN, PREMIUM, SLEEK UI following current best practices: clean layouts, proper spacing, accessible colors, responsive design, smooth animations.`;

    return `You are a Senior UI/UX Designer specializing in modern web interfaces.

Goal: Design the complete frontend UI for this project.

${designDirective}

Project: ${task}
Architecture: ${JSON.stringify(architecture)}

OUTPUT FORMAT (Strict JSON):
{
  "design_system": {
    "colors": {
      "primary": "#hex",
      "secondary": "#hex",
      "background": "#hex",
      "surface": "#hex",
      "text": "#hex",
      "text_secondary": "#hex",
      "accent": "#hex",
      "success": "#hex",
      "warning": "#hex",
      "error": "#hex"
    },
    "typography": {
      "headings": { "font": "...", "weights": [300, 400, 600, 700] },
      "body": { "font": "...", "size": "..." },
      "monospace": { "font": "..." }
    },
    "spacing": { "unit": 4, "scale": [4, 8, 12, 16, 24, 32, 48, 64] },
    "border_radius": "...",
    "shadows": ["...", "..."],
    "transitions": "..."
  },
  "component_tree": [
    { "name": "ComponentName", "description": "...", "props": [...], "children": ["..."] }
  ],
  "layout": {
    "type": "spa | mpa",
    "navigation": "sidebar | topbar | bottom",
    "responsive_breakpoints": { "sm": 640, "md": 768, "lg": 1024, "xl": 1280 },
    "grid_system": "12-column | flex"
  },
  "pages": [
    { "route": "/...", "components": ["..."], "description": "..." }
  ],
  "animation_guidelines": "...",
  "accessibility_notes": "..."
}

Return ONLY the raw JSON object.`;
  }
}

/**
 * 🗄️ Backend Designer Agent
 * API tasarımı, DB şeması, dosya yapısı, middleware gibi backend kararlarını verir.
 */
export class BackendDesignerAgent extends BaseAgent {
  constructor() {
    super('Data', 'backend_designer');
  }

  buildPrompt(context) {
    const { task, architecture } = context;

    return `You are a Senior Backend & Database Architect.

Goal: Design the complete backend infrastructure for this project.

Project: ${task}
Architecture: ${JSON.stringify(architecture)}

OUTPUT FORMAT (Strict JSON):
{
  "database": {
    "type": "postgresql | mongodb | sqlite | ...",
    "schema": [
      {
        "table": "name",
        "columns": [
          { "name": "id", "type": "uuid | serial", "primary_key": true, "default": "gen_random_uuid()" }
        ],
        "relations": [
          { "type": "belongs_to | has_many", "table": "...", "foreign_key": "..." }
        ],
        "indexes": ["column1", "column2"]
      }
    ],
    "migration_strategy": "orm-based | manual"
  },
  "api": {
    "type": "REST | GraphQL",
    "base_url": "/api/v1",
    "endpoints": [
      {
        "method": "GET | POST | PUT | DELETE",
        "path": "/resource",
        "description": "...",
        "request": { "headers": {}, "body": {} },
        "response": { "status": 200, "body": {} }
      }
    ],
    "auth": "jwt | session | oauth | none",
    "middleware": ["auth", "validation", "error_handler", "rate_limiter"]
  },
  "file_structure": [
    "src/server.js",
    "src/routes/...",
    "src/models/...",
    "src/middleware/..."
  ],
  "validation_rules": "...",
  "error_handling": "..."
}

Return ONLY the raw JSON object.`;
  }
}
