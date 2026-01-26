import { callGLM } from '../../helpers/index.js';

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
    return `You are a Senior Full Stack Developer.
Your goal is to implement the solution designed by the Architect.
Write clean, distinct, efficient code.

Task: ${context.task}
Architect's Design: ${context.design}

Output strict JSON format. 
Response must be a SINGLE JSON array of objects, where each object represents a file to be created or modified.
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
    return `You are a QA Automation Engineer.
Your goal is to verify the code written by the Developer.
1. Analyze the code for bugs.
2. Write comprehensive unit tests.

Code to Verify: ${context.code}

Output the test code and bug report.`;
  }
}
