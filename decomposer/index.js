import { generateUUID } from '../config.js';
import { MemoryManager } from '../memory/index.js';
import { defaultRegistry } from '../registry/ToolRegistry.js';

export const DECOMPOSITION_CONFIG = {
  maxSubtasks: 10,
  minComplexityForDecomposition: 3,
  dependencyResolutionTimeout: 30000,
  complexityThresholds: {
    simple: 1,
    medium: 3,
    complex: 5,
    veryComplex: 8
  }
};

export class TaskDecomposer {
  constructor(projectPath = null, glmClient = null) {
    this.projectPath = projectPath;
    this.memory = new MemoryManager(projectPath);
    this.glmClient = glmClient;
    this.decompositionCache = new Map();
  }
  
  setProject(projectPath) {
    this.projectPath = projectPath;
    this.memory.setProject(projectPath);
  }
  
  setGLMClient(client) {
    this.glmClient = client;
  }
  
  async decompose(task, context = {}) {
    const taskId = generateUUID();
    const startTime = Date.now();
    
    const complexity = await this.analyzeComplexity(task, context);
    
    if (complexity.score < DECOMPOSITION_CONFIG.minComplexityForDecomposition) {
      return {
        taskId,
        originalTask: task,
        complexity,
        decomposed: false,
        reason: 'Task is simple enough to execute directly',
        subtasks: [{
          id: 1,
          description: task,
          tool: complexity.suggestedTool,
          args: context,
          dependencies: [],
          parallelGroup: 0,
          priority: 1
        }],
        executionPlan: { sequential: false, groups: [[0]] }
      };
    }
    
    const subtasks = await this.generateSubtasks(task, context, complexity);
    const dependencyGraph = this.resolveDependencies(subtasks);
    const parallelGroups = this.createParallelGroups(subtasks, dependencyGraph);
    
    const result = {
      taskId,
      originalTask: task,
      complexity,
      decomposed: true,
      subtasks,
      dependencyGraph,
      parallelGroups,
      executionPlan: this.buildExecutionPlan(parallelGroups),
      decompositionTime: Date.now() - startTime
    };
    
    this.decompositionCache.set(taskId, result);
    
    if (this.projectPath) {
      this.memory.setSessionVariable(`decomposition_${taskId}`, result);
    }
    
    return result;
  }
  
  async analyzeComplexity(task, context = {}) {
    const indicators = {
      hasMultipleFiles: this.detectMultipleFiles(task),
      hasMultipleActions: this.detectMultipleActions(task),
      requiresAnalysis: this.detectAnalysisRequirement(task),
      requiresGeneration: this.detectGenerationRequirement(task),
      hasConditionalLogic: this.detectConditionalLogic(task),
      estimatedSteps: this.estimateSteps(task)
    };
    
    let score = 0;
    if (indicators.hasMultipleFiles) score += 2;
    if (indicators.hasMultipleActions) score += 2;
    if (indicators.requiresAnalysis) score += 1;
    if (indicators.requiresGeneration) score += 2;
    if (indicators.hasConditionalLogic) score += 1;
    score += Math.min(indicators.estimatedSteps, 3);
    
    const level = this.getComplexityLevel(score);
    const suggestedTool = await this.suggestPrimaryTool(task, context);
    
    return {
      score,
      level,
      indicators,
      suggestedTool,
      recommendDecomposition: score >= DECOMPOSITION_CONFIG.minComplexityForDecomposition
    };
  }
  
  detectMultipleFiles(task) {
    const filePatterns = [
      /multiple\s+files?/i,
      /all\s+files?/i,
      /each\s+file/i,
      /directory/i,
      /folder/i,
      /project/i,
      /codebase/i
    ];
    return filePatterns.some(p => p.test(task));
  }
  
  detectMultipleActions(task) {
    const actionWords = ['and', 'then', 'also', 'after', 'before', 'following', 'next'];
    const taskLower = task.toLowerCase();
    return actionWords.filter(w => taskLower.includes(` ${w} `)).length >= 1;
  }
  
  detectAnalysisRequirement(task) {
    const analysisPatterns = [
      /analy[sz]e/i,
      /review/i,
      /check/i,
      /find\s+(bugs?|issues?|problems?)/i,
      /security/i,
      /performance/i,
      /audit/i
    ];
    return analysisPatterns.some(p => p.test(task));
  }
  
  detectGenerationRequirement(task) {
    const generationPatterns = [
      /create/i,
      /generate/i,
      /write/i,
      /implement/i,
      /build/i,
      /add/i,
      /develop/i
    ];
    return generationPatterns.some(p => p.test(task));
  }
  
  detectConditionalLogic(task) {
    const conditionalPatterns = [
      /if\s+/i,
      /when\s+/i,
      /unless/i,
      /depending\s+on/i,
      /based\s+on/i,
      /in\s+case/i
    ];
    return conditionalPatterns.some(p => p.test(task));
  }
  
  estimateSteps(task) {
    const stepIndicators = [
      /first/i, /second/i, /third/i, /fourth/i, /fifth/i,
      /step\s*\d/i, /phase\s*\d/i,
      /\d\.\s+/g, /•/g, /-\s+/g
    ];
    
    let count = 0;
    for (const pattern of stepIndicators) {
      const matches = task.match(pattern);
      if (matches) count += matches.length;
    }
    
    const andCount = (task.match(/\band\b/gi) || []).length;
    count += andCount;
    
    return Math.max(1, Math.min(count, 10));
  }
  
  getComplexityLevel(score) {
    const { complexityThresholds } = DECOMPOSITION_CONFIG;
    if (score <= complexityThresholds.simple) return 'simple';
    if (score <= complexityThresholds.medium) return 'medium';
    if (score <= complexityThresholds.complex) return 'complex';
    return 'very_complex';
  }
  
  async suggestPrimaryTool(task, context) {
    const matchedTool = defaultRegistry.findByPattern(task);
    
    if (matchedTool) {
      return matchedTool;
    }
    
    if (this.projectPath) {
      const bestTool = await this.memory.getBestToolForTask(task);
      if (bestTool) return bestTool.tool_name;
    }
    
    return 'deep_think_chat';
  }
  
  async generateSubtasks(task, context, complexity) {
    const subtasks = [];
    
    if (this.glmClient) {
      const aiSubtasks = await this.generateSubtasksWithAI(task, context, complexity);
      return aiSubtasks;
    }
    
    const patterns = this.extractTaskPatterns(task);
    
    if (patterns.files.length > 0) {
      for (let i = 0; i < patterns.files.length; i++) {
        subtasks.push({
          id: subtasks.length + 1,
          description: `Process file: ${patterns.files[i]}`,
          tool: complexity.suggestedTool || 'read_file',
          args: { filePath: patterns.files[i], ...context },
          dependencies: [],
          parallelGroup: 0,
          priority: 1
        });
      }
    }
    
    if (patterns.actions.length > 0) {
      for (let i = 0; i < patterns.actions.length; i++) {
        const action = patterns.actions[i];
        const tool = await this.suggestPrimaryTool(action, context);
        
        subtasks.push({
          id: subtasks.length + 1,
          description: action,
          tool,
          args: context,
          dependencies: i > 0 ? [subtasks.length] : [],
          parallelGroup: i,
          priority: i + 1
        });
      }
    }
    
    if (subtasks.length === 0) {
      subtasks.push({
        id: 1,
        description: task,
        tool: complexity.suggestedTool || 'deep_think_chat',
        args: { prompt: task, ...context },
        dependencies: [],
        parallelGroup: 0,
        priority: 1
      });
    }
    
    return subtasks.slice(0, DECOMPOSITION_CONFIG.maxSubtasks);
  }
  
  async generateSubtasksWithAI(task, context, complexity) {
    const prompt = `
Analyze this task and break it down into subtasks:

Task: ${task}
Context: ${JSON.stringify(context)}
Complexity: ${complexity.level}

Return a JSON array of subtasks with format:
[{
  "description": "subtask description",
  "tool": "suggested_tool_name",
  "dependencies": [list of prerequisite subtask indices],
  "canParallelize": true/false
}]

Available tools: read_file, write_file, refactor_code, find_bugs, security_scan, 
optimize_code, generate_tests, generate_docs, explain_code, search_in_files, 
analyze_directory, read_project, deep_think_chat

Return ONLY the JSON array, no other text.
`;

    try {
      const response = await this.glmClient.chat(prompt);
      const parsed = JSON.parse(response);
      
      return parsed.map((item, index) => ({
        id: index + 1,
        description: item.description,
        tool: item.tool || 'deep_think_chat',
        args: { ...context, prompt: item.description },
        dependencies: item.dependencies || [],
        parallelGroup: item.canParallelize ? 0 : index,
        priority: index + 1
      }));
    } catch {
      return this.generateSubtasks(task, context, complexity);
    }
  }
  
  extractTaskPatterns(task) {
    const filePatterns = [
      /(?:file|path):\s*([^\s,]+)/gi,
      /["']([^"']+\.[a-z]{2,4})["']/gi,
      /([a-zA-Z0-9_\-/.]+\.(js|ts|jsx|tsx|py|java|go|rs|php|rb|css|html|json|md))/gi
    ];
    
    const files = [];
    for (const pattern of filePatterns) {
      const matches = task.matchAll(pattern);
      for (const match of matches) {
        files.push(match[1]);
      }
    }
    
    const actionSplitters = [
      /\.\s+Then\s+/i,
      /\.\s+After\s+that[,]?\s+/i,
      /\.\s+Next[,]?\s+/i,
      /\.\s+Finally[,]?\s+/i,
      /;\s+/,
      /\band\s+then\b/i
    ];
    
    let actions = [task];
    for (const splitter of actionSplitters) {
      const newActions = [];
      for (const action of actions) {
        newActions.push(...action.split(splitter).filter(a => a.trim()));
      }
      actions = newActions;
    }
    
    return {
      files: [...new Set(files)],
      actions: actions.map(a => a.trim()).filter(a => a.length > 10)
    };
  }
  
  resolveDependencies(subtasks) {
    const graph = new Map();
    
    for (const subtask of subtasks) {
      graph.set(subtask.id, {
        subtask,
        dependsOn: new Set(subtask.dependencies),
        requiredBy: new Set()
      });
    }
    
    for (const [id, node] of graph) {
      for (const depId of node.dependsOn) {
        const depNode = graph.get(depId);
        if (depNode) {
          depNode.requiredBy.add(id);
        }
      }
    }
    
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (id) => {
      if (recursionStack.has(id)) return true;
      if (visited.has(id)) return false;
      
      visited.add(id);
      recursionStack.add(id);
      
      const node = graph.get(id);
      for (const depId of node.dependsOn) {
        if (hasCycle(depId)) return true;
      }
      
      recursionStack.delete(id);
      return false;
    };
    
    for (const id of graph.keys()) {
      if (hasCycle(id)) {
        throw new Error(`Circular dependency detected involving subtask ${id}`);
      }
    }
    
    return Object.fromEntries(
      Array.from(graph.entries()).map(([id, node]) => [
        id,
        {
          dependsOn: Array.from(node.dependsOn),
          requiredBy: Array.from(node.requiredBy)
        }
      ])
    );
  }
  
  createParallelGroups(subtasks, dependencyGraph) {
    const groups = [];
    const completed = new Set();
    const remaining = new Set(subtasks.map(s => s.id));
    
    while (remaining.size > 0) {
      const currentGroup = [];
      
      for (const id of remaining) {
        const deps = dependencyGraph[id]?.dependsOn || [];
        const allDepsCompleted = deps.every(depId => completed.has(depId));
        
        if (allDepsCompleted) {
          currentGroup.push(id);
        }
      }
      
      if (currentGroup.length === 0) {
        throw new Error('Cannot resolve dependencies - possible deadlock');
      }
      
      for (const id of currentGroup) {
        remaining.delete(id);
        completed.add(id);
      }
      
      groups.push(currentGroup);
    }
    
    return groups;
  }
  
  buildExecutionPlan(parallelGroups) {
    return {
      totalGroups: parallelGroups.length,
      groups: parallelGroups.map((group, index) => ({
        order: index + 1,
        subtaskIds: group,
        canParallelize: group.length > 1,
        estimatedConcurrency: Math.min(group.length, 3)
      })),
      estimatedTotalSteps: parallelGroups.reduce((sum, g) => sum + 1, 0)
    };
  }
  
  validateSubtask(subtask) {
    if (!subtask.id) {
      return { valid: false, reason: 'Subtask must have an id' };
    }
    
    if (!subtask.description || subtask.description.trim().length < 5) {
      return { valid: false, reason: 'Subtask must have a meaningful description' };
    }
    
    if (!subtask.tool) {
      return { valid: false, reason: 'Subtask must have a tool assigned' };
    }
    
    return { valid: true };
  }
  
  getDecomposition(taskId) {
    return this.decompositionCache.get(taskId);
  }
  
  clearCache() {
    this.decompositionCache.clear();
  }
}
