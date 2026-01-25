import { generateUUID, ORCHESTRATION_CONFIG } from '../config.js';
import { MemoryManager } from '../memory/index.js';
import { sleep, calculateBackoff, summarizeResult, shouldRetryError } from '../utils/index.js';

export const AGENT_CONFIG = {
  maxParallelAgents: 5,
  agentTimeout: 300000,
  healthCheckInterval: 10000,
  maxQueueSize: 50,
  maxRetries: 3,
  retryDelay: 1000
};

class AgentState {
  static IDLE = 'idle';
  static RUNNING = 'running';
  static COMPLETED = 'completed';
  static FAILED = 'failed';
  static CANCELLED = 'cancelled';
}

export class MiniAgent {
  constructor(id, config = {}) {
    this.id = id || generateUUID();
    this.config = { ...AGENT_CONFIG, ...config };
    this.state = AgentState.IDLE;
    this.currentTask = null;
    this.result = null;
    this.error = null;
    this.startTime = null;
    this.endTime = null;
    this.retryCount = 0;
    this.context = {};
  }
  
  async execute(task, toolExecutor) {
    this.state = AgentState.RUNNING;
    this.currentTask = task;
    this.startTime = Date.now();
    this.error = null;
    
    try {
      const result = await this.executeWithRetry(task, toolExecutor);
      
      this.state = AgentState.COMPLETED;
      this.result = result;
      this.endTime = Date.now();
      
      return {
        agentId: this.id,
        taskId: task.id,
        success: true,
        result,
        executionTime: this.endTime - this.startTime,
        retries: this.retryCount
      };
      
    } catch (error) {
      this.state = AgentState.FAILED;
      this.error = error;
      this.endTime = Date.now();
      
      return {
        agentId: this.id,
        taskId: task.id,
        success: false,
        error: error.message,
        executionTime: this.endTime - this.startTime,
        retries: this.retryCount
      };
    }
  }
  
  async executeWithRetry(task, toolExecutor) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      this.retryCount = attempt;
      
      try {
        return await this.executeTask(task, toolExecutor);
      } catch (error) {
        lastError = error;
        
        const shouldRetry = this.shouldRetry(error, attempt);
        if (!shouldRetry) {
          throw error;
        }
        
        const delay = this.getBackoffDelay(attempt);
        await sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  async executeTask(task, toolExecutor) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${this.config.agentTimeout}ms`));
      }, this.config.agentTimeout);
    });
    
    const executionPromise = toolExecutor(task.tool, {
      ...task.args,
      prompt: task.description,
      _agentId: this.id,
      _taskId: task.id
    });
    
    return Promise.race([executionPromise, timeoutPromise]);
  }
  
  shouldRetry(error, attempt) {
    if (attempt >= this.config.maxRetries) return false;
    const result = shouldRetryError(error, attempt, this.config.maxRetries);
    return result.retry;
  }
  
  getBackoffDelay(attempt) {
    return calculateBackoff(attempt, { baseDelay: this.config.retryDelay });
  }
  
  cancel() {
    if (this.state === AgentState.RUNNING) {
      this.state = AgentState.CANCELLED;
      this.endTime = Date.now();
    }
  }
  
  reset() {
    this.state = AgentState.IDLE;
    this.currentTask = null;
    this.result = null;
    this.error = null;
    this.startTime = null;
    this.endTime = null;
    this.retryCount = 0;
  }
  
  getStatus() {
    return {
      id: this.id,
      state: this.state,
      taskId: this.currentTask?.id,
      retryCount: this.retryCount,
      executionTime: this.endTime && this.startTime 
        ? this.endTime - this.startTime 
        : this.startTime 
          ? Date.now() - this.startTime 
          : 0
    };
  }
}

export class AgentPool {
  constructor(maxAgents = AGENT_CONFIG.maxParallelAgents) {
    this.maxAgents = maxAgents;
    this.agents = [];
    this.taskQueue = [];
    this.activeCount = 0;
    this.completedTasks = [];
    this.failedTasks = [];
    this.isRunning = false;
  }
  
  async executeParallel(tasks, toolExecutor) {
    this.isRunning = true;
    this.taskQueue = [...tasks];
    this.completedTasks = [];
    this.failedTasks = [];
    
    const startTime = Date.now();
    const results = [];
    
    const executeNext = async () => {
      while (this.taskQueue.length > 0 && this.isRunning) {
        if (this.activeCount >= this.maxAgents) {
          await sleep(100);
          continue;
        }
        
        const task = this.taskQueue.shift();
        if (!task) break;
        
        this.activeCount++;
        const agent = this.getOrCreateAgent();
        
        try {
          const result = await agent.execute(task, toolExecutor);
          results.push(result);
          
          if (result.success) {
            this.completedTasks.push(result);
          } else {
            this.failedTasks.push(result);
          }
        } finally {
          this.activeCount--;
          agent.reset();
        }
      }
    };
    
    const workers = [];
    const workerCount = Math.min(this.maxAgents, tasks.length);
    
    for (let i = 0; i < workerCount; i++) {
      workers.push(executeNext());
    }
    
    await Promise.all(workers);
    this.isRunning = false;
    
    return {
      totalTasks: tasks.length,
      completed: this.completedTasks.length,
      failed: this.failedTasks.length,
      results,
      executionTime: Date.now() - startTime,
      avgTimePerTask: results.length > 0 
        ? results.reduce((sum, r) => sum + r.executionTime, 0) / results.length 
        : 0
    };
  }
  
  getOrCreateAgent() {
    let agent = this.agents.find(a => a.state === AgentState.IDLE);
    
    if (!agent) {
      agent = new MiniAgent();
      this.agents.push(agent);
    }
    
    return agent;
  }
  
  stop() {
    this.isRunning = false;
    for (const agent of this.agents) {
      agent.cancel();
    }
  }
  
  getStatus() {
    return {
      maxAgents: this.maxAgents,
      totalAgents: this.agents.length,
      activeAgents: this.activeCount,
      queuedTasks: this.taskQueue.length,
      completedCount: this.completedTasks.length,
      failedCount: this.failedTasks.length,
      isRunning: this.isRunning,
      agents: this.agents.map(a => a.getStatus())
    };
  }
  

  
  reset() {
    this.stop();
    this.agents = [];
    this.taskQueue = [];
    this.completedTasks = [];
    this.failedTasks = [];
    this.activeCount = 0;
  }
}

export class AgentCoordinator {
  constructor(projectPath = null, toolExecutor = null) {
    this.projectPath = projectPath;
    this.memory = new MemoryManager(projectPath);
    this.toolExecutor = toolExecutor;
    this.pool = new AgentPool();
    this.currentExecution = null;
    this.executionHistory = [];
  }
  
  setProject(projectPath) {
    this.projectPath = projectPath;
    this.memory.setProject(projectPath);
  }
  
  setToolExecutor(executor) {
    this.toolExecutor = executor;
  }
  
  async orchestrate(decomposedTask) {
    if (!this.toolExecutor) {
      throw new Error('No tool executor configured');
    }
    
    const executionId = generateUUID();
    const startTime = Date.now();
    
    this.currentExecution = {
      id: executionId,
      taskId: decomposedTask.taskId,
      status: 'running',
      startTime,
      results: []
    };
    
    const allResults = [];
    const subtaskMap = new Map(
      decomposedTask.subtasks.map(s => [s.id, s])
    );
    
    const executionPlan = decomposedTask.executionPlan || decomposedTask.parallelGroups;
    const groups = executionPlan.groups || decomposedTask.parallelGroups;
    
    try {
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const subtaskIds = group.subtaskIds || group;
        const subtasks = subtaskIds.map(id => subtaskMap.get(id)).filter(Boolean);
        
        if (subtasks.length === 0) continue;
        
        if (subtasks.length === 1) {
          const agent = new MiniAgent();
          const result = await agent.execute(subtasks[0], this.toolExecutor);
          allResults.push(result);
          
          if (!result.success && !decomposedTask.continueOnError) {
            break;
          }
        } else {
          const poolResult = await this.pool.executeParallel(subtasks, this.toolExecutor);
          allResults.push(...poolResult.results);
          
          const hasFailure = poolResult.results.some(r => !r.success);
          if (hasFailure && !decomposedTask.continueOnError) {
            break;
          }
        }
        
        await this.recordGroupProgress(executionId, i, allResults.slice(-subtasks.length));
      }
      
      this.currentExecution.status = 'completed';
      
    } catch (error) {
      this.currentExecution.status = 'failed';
      this.currentExecution.error = error.message;
    }
    
    this.currentExecution.endTime = Date.now();
    this.currentExecution.results = allResults;
    
    const summary = this.synthesizeResults(allResults, decomposedTask);
    
    this.executionHistory.push({
      ...this.currentExecution,
      summary
    });
    
    if (this.projectPath) {
      await this.recordExecution(executionId, decomposedTask, summary);
    }
    
    return {
      executionId,
      taskId: decomposedTask.taskId,
      originalTask: decomposedTask.originalTask,
      status: this.currentExecution.status,
      results: allResults,
      summary,
      executionTime: this.currentExecution.endTime - startTime
    };
  }
  
  synthesizeResults(results, decomposedTask) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return {
      totalSubtasks: decomposedTask.subtasks.length,
      completed: successful.length,
      failed: failed.length,
      successRate: results.length > 0 
        ? (successful.length / results.length * 100).toFixed(1) + '%' 
        : '0%',
      totalRetries: results.reduce((sum, r) => sum + (r.retries || 0), 0),
      avgExecutionTime: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.executionTime, 0) / results.length) 
        : 0,
      failedTasks: failed.map(f => ({
        taskId: f.taskId,
        error: f.error
      })),
      outputs: successful.map(s => ({
        taskId: s.taskId,
        result: this.summarizeResultText(s.result)
      }))
    };
  }
  
  summarizeResultText(result) {
    return summarizeResult(result, 500);
  }
  
  async recordGroupProgress(executionId, groupIndex, results) {
    if (this.projectPath) {
      this.memory.setSessionVariable(`execution_${executionId}_group_${groupIndex}`, {
        completedAt: new Date().toISOString(),
        results: results.map(r => ({
          taskId: r.taskId,
          success: r.success,
          executionTime: r.executionTime
        }))
      });
    }
  }
  
  async recordExecution(executionId, decomposedTask, summary) {
    for (const result of this.currentExecution.results) {
      const subtask = decomposedTask.subtasks.find(s => s.id === result.taskId);
      if (subtask) {
        await this.memory.recordToolExecution(
          subtask.tool,
          { executionId, subtaskId: result.taskId },
          result.success,
          result.executionTime
        );
      }
    }
  }
  
  getStatus() {
    return {
      currentExecution: this.currentExecution,
      poolStatus: this.pool.getStatus(),
      historyCount: this.executionHistory.length
    };
  }
  
  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }
  
  cancel() {
    if (this.currentExecution && this.currentExecution.status === 'running') {
      this.currentExecution.status = 'cancelled';
      this.pool.stop();
    }
  }
  
  reset() {
    this.pool.reset();
    this.currentExecution = null;
  }
}
