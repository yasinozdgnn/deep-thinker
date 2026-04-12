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
Goal: Implement the technical blueprint with Zero-Bug/Production-Grade quality.

${CODE_QUALITY_REQUIREMENTS}

${PREMIUM_UI_GUIDELINES}

${stackRules}

Task: ${context.task}
Architect's Design: ${context.design}

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
