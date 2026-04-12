import { callGLM } from '../../helpers/index.js';
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
    const response = await callGLM(prompt);
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
Goal: Implement the technical blueprint designed by the Architect with Zero-Bug/Production-Grade quality.

${CODE_QUALITY_REQUIREMENTS}

${PREMIUM_UI_GUIDELINES}

${stackRules}

Task Description: ${context.task}
Architect's Instructions: ${context.design}

OUTPUT RULES:
1. Write scalable, modular, and self-explanatory code.
2. Use modern CSS (Grid/Flexbox/Animations). No outdated table layouts or unstyled tags.
3. Ensure interactivity is smooth and handles errors gracefully.
4. Output strict JSON format. 
5. Response must be a SINGLE JSON array of objects, where each object represents a file.
Format:
[
  {
    "fileName": "path/to/file.js",
    "content": "raw code content here"
  }
]

Do NOT wrap the JSON in markdown code blocks. Just return the raw JSON string.`;
  }
}

export class QAAgent extends BaseAgent {
  constructor() {
    super('Tester', 'qa_engineer');
  }

  buildPrompt(context) {
    const stackRules = getFrameworkRules(context.stack || []);

    return `Persona: Senior QA Auditor & Security Specialist
Goal: Rigorously verify the generated code for technical integrity, security, and UI excellence.

${stackRules}

VERIFICATION CRITERIA:
1. SYNTAX & LOGIC: Check for missing brackets, undefined variables, or logically impossible loops.
2. DEPENDENCIES: Are all imported files/assets available in the project context?
3. UI QUALITY: Does the CSS meet "Premium" standards (Gradients, Animations, No browser defaults)?
4. COMPLIANCE: Does the code follow SOLID/DRY and FRAMEWORK-SPECIFIC principles?
5. ROBUSTNESS: Are there proper try-catch blocks and input validations?

Code to Audit:
${context.code}

Output a detailed audit report in JSON format:
{
  "status": "PASS" | "FAIL",
  "issues": [
    { "file": "string", "issue": "string", "severity": "LOW" | "HIGH", "fix": "string" }
  ],
  "overall_quality_score": 1-10,
  "recommendations": ["string"]
}

Do NOT wrap the JSON in markdown code blocks. Just return the raw JSON string.`;
  }
}
