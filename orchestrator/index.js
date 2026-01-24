import { ORCHESTRATION_CONFIG, LEARNING_GUARDRAILS, generateUUID } from '../config.js';
import { MemoryManager } from '../memory/index.js';

class CircuitBreaker {
  constructor(threshold = 3) {
    this.failures = new Map();
    this.threshold = threshold;
  }
  
  recordFailure(toolName) {
    const count = (this.failures.get(toolName) || 0) + 1;
    this.failures.set(toolName, count);
    return count >= this.threshold;
  }
  
  recordSuccess(toolName) {
    this.failures.set(toolName, 0);
  }
  
  isOpen(toolName) {
    return (this.failures.get(toolName) || 0) >= this.threshold;
  }
  
  reset(toolName = null) {
    if (toolName) {
      this.failures.delete(toolName);
    } else {
      this.failures.clear();
    }
  }
}

class ResourceLock {
  constructor() {
    this.locks = new Map();
  }
  
  async acquire(resourceId, timeout = 5000) {
    const start = Date.now();
    
    while (this.locks.has(resourceId)) {
      if (Date.now() - start > timeout) {
        throw new Error(`Timeout acquiring lock for ${resourceId}`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.locks.set(resourceId, {
      acquiredAt: Date.now(),
      owner: generateUUID()
    });
    
    return this.locks.get(resourceId).owner;
  }
  
  release(resourceId, ownerId = null) {
    const lock = this.locks.get(resourceId);
    
    if (!lock) return true;
    if (ownerId && lock.owner !== ownerId) return false;
    
    this.locks.delete(resourceId);
    return true;
  }
  
  isLocked(resourceId) {
    return this.locks.has(resourceId);
  }
}

export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.2,
  retryableErrors: ['timeout', 'network', 'rate_limit', 'service_unavailable', 'connection'],
  nonRetryableErrors: ['permission', 'file_not_found', 'syntax_error', 'validation']
};

export class RetryManager {
  constructor(config = {}) {
    this.config = { ...RETRY_CONFIG, ...config };
    this.retryHistory = new Map();
  }
  
  async executeWithRetry(fn, context = {}) {
    const { toolName = 'unknown' } = context;
    let lastError;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          this.recordRetrySuccess(toolName, attempt);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        const shouldRetry = this.shouldRetry(error, attempt);
        
        if (!shouldRetry.retry) {
          this.recordRetryFailure(toolName, attempt, error, shouldRetry.reason);
          throw error;
        }
        
        const delay = this.calculateBackoff(attempt);
        await this.sleep(delay);
      }
    }
    
    this.recordRetryFailure(toolName, this.config.maxRetries, lastError, 'max_retries_exceeded');
    throw lastError;
  }
  
  shouldRetry(error, attempt) {
    if (attempt >= this.config.maxRetries) {
      return { retry: false, reason: 'max_retries_exceeded' };
    }
    
    const errorMessage = (error.message || '').toLowerCase();
    const errorType = this.classifyError(errorMessage);
    
    if (this.config.nonRetryableErrors.includes(errorType)) {
      return { retry: false, reason: `non_retryable_error_type: ${errorType}` };
    }
    
    if (this.config.retryableErrors.includes(errorType)) {
      return { retry: true, reason: `retryable_error_type: ${errorType}`, delay: this.calculateBackoff(attempt) };
    }
    
    return { retry: false, reason: 'unknown_error_type' };
  }
  
  classifyError(errorMessage) {
    const patterns = {
      timeout: [/timeout/i, /timed?\s*out/i],
      network: [/network/i, /connection/i, /econnrefused/i, /enotfound/i],
      rate_limit: [/rate.?limit/i, /too.?many.?requests/i, /429/],
      service_unavailable: [/503/, /502/, /504/, /service.?unavailable/i],
      permission: [/permission/i, /access.?denied/i, /forbidden/i, /403/],
      file_not_found: [/not.?found/i, /enoent/i, /404/],
      syntax_error: [/syntax/i, /parse.?error/i],
      validation: [/validation/i, /invalid/i, /schema/i]
    };
    
    for (const [type, regexes] of Object.entries(patterns)) {
      if (regexes.some(r => r.test(errorMessage))) {
        return type;
      }
    }
    
    return 'unknown';
  }
  
  calculateBackoff(attempt) {
    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt);
    const maxJitter = exponentialDelay * this.config.jitterFactor;
    const jitter = Math.random() * maxJitter * 2 - maxJitter;
    const delay = Math.min(exponentialDelay + jitter, this.config.maxDelay);
    return Math.max(delay, this.config.baseDelay);
  }
  
  recordRetrySuccess(toolName, attempts) {
    const history = this.retryHistory.get(toolName) || { successes: 0, failures: 0, totalRetries: 0 };
    history.successes++;
    history.totalRetries += attempts;
    history.lastSuccess = new Date().toISOString();
    this.retryHistory.set(toolName, history);
  }
  
  recordRetryFailure(toolName, attempts, error, reason) {
    const history = this.retryHistory.get(toolName) || { successes: 0, failures: 0, totalRetries: 0 };
    history.failures++;
    history.totalRetries += attempts;
    history.lastFailure = { time: new Date().toISOString(), error: error.message, reason };
    this.retryHistory.set(toolName, history);
  }
  
  getRetryStats(toolName = null) {
    if (toolName) {
      return this.retryHistory.get(toolName);
    }
    return Object.fromEntries(this.retryHistory);
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class ValidationEngine {
  constructor() {
    this.validationRules = new Map();
    this.validationHistory = [];
  }
  
  registerRule(toolName, rule) {
    const rules = this.validationRules.get(toolName) || [];
    rules.push(rule);
    this.validationRules.set(toolName, rules);
  }
  
  async validateInput(tool, args) {
    const results = { valid: true, errors: [], warnings: [] };
    
    const basicValidation = this.validateBasicInput(tool, args);
    if (!basicValidation.valid) {
      return basicValidation;
    }
    
    const patternValidation = this.validateAgainstPatterns(args, LEARNING_GUARDRAILS.forbiddenPatterns);
    if (!patternValidation.valid) {
      return patternValidation;
    }
    
    const toolRules = this.validationRules.get(tool) || [];
    for (const rule of toolRules) {
      try {
        const ruleResult = await rule.validate(args);
        if (!ruleResult.valid) {
          results.valid = false;
          results.errors.push(ruleResult.error);
        }
        if (ruleResult.warning) {
          results.warnings.push(ruleResult.warning);
        }
      } catch (error) {
        results.warnings.push(`Rule validation error: ${error.message}`);
      }
    }
    
    this.recordValidation(tool, 'input', results);
    return results;
  }
  
  validateBasicInput(tool, args) {
    if (args === null || args === undefined) {
      return { valid: false, errors: ['Arguments cannot be null or undefined'], warnings: [] };
    }
    
    if (typeof args !== 'object') {
      return { valid: false, errors: ['Arguments must be an object'], warnings: [] };
    }
    
    const fileTools = ['read_file', 'write_file', 'refactor_code', 'explain_code'];
    if (fileTools.includes(tool) && !args.filePath) {
      return { valid: false, errors: [`${tool} requires filePath argument`], warnings: [] };
    }
    
    const dirTools = ['list_directory', 'analyze_directory', 'search_in_files'];
    if (dirTools.includes(tool) && !args.dirPath) {
      return { valid: false, errors: [`${tool} requires dirPath argument`], warnings: [] };
    }
    
    return { valid: true, errors: [], warnings: [] };
  }
  
  async validateOutput(tool, result) {
    const results = { valid: true, errors: [], warnings: [] };
    
    if (result === undefined) {
      results.warnings.push('Output is undefined');
    }
    
    if (result && result.error) {
      results.valid = false;
      results.errors.push(`Tool returned error: ${result.error}`);
    }
    
    if (result?.content?.[0]?.text) {
      const text = result.content[0].text;
      
      if (text.length > 100000) {
        results.warnings.push('Output is very large (>100KB)');
      }
      
      const errorPatterns = [/error/i, /failed/i, /exception/i];
      if (errorPatterns.some(p => p.test(text.substring(0, 500)))) {
        results.warnings.push('Output may contain error messages');
      }
    }
    
    this.recordValidation(tool, 'output', results);
    return results;
  }
  
  async validateStateChange(before, after, context = {}) {
    const changes = [];
    
    if (typeof before === 'string' && typeof after === 'string') {
      const beforeLines = before.split('\n').length;
      const afterLines = after.split('\n').length;
      const lineDiff = afterLines - beforeLines;
      
      changes.push({
        type: 'line_count',
        before: beforeLines,
        after: afterLines,
        diff: lineDiff,
        significant: Math.abs(lineDiff) > beforeLines * 0.5
      });
      
      const beforeSize = before.length;
      const afterSize = after.length;
      const sizeDiff = afterSize - beforeSize;
      
      changes.push({
        type: 'size',
        before: beforeSize,
        after: afterSize,
        diff: sizeDiff,
        significant: Math.abs(sizeDiff) > beforeSize * 0.5
      });
    }
    
    const significantChanges = changes.filter(c => c.significant);
    
    return {
      valid: true,
      changes,
      warnings: significantChanges.map(c => 
        `Significant ${c.type} change: ${c.before} → ${c.after} (${c.diff > 0 ? '+' : ''}${c.diff})`
      ),
      requiresReview: significantChanges.length > 0
    };
  }
  
  validateAgainstPatterns(data, forbiddenPatterns) {
    const dataStr = JSON.stringify(data).toLowerCase();
    
    for (const pattern of forbiddenPatterns) {
      if (dataStr.includes(pattern.toLowerCase())) {
        return {
          valid: false,
          errors: [`Forbidden pattern detected: ${pattern}`],
          warnings: []
        };
      }
    }
    
    return { valid: true, errors: [], warnings: [] };
  }
  
  recordValidation(tool, type, result) {
    this.validationHistory.push({
      tool,
      type,
      valid: result.valid,
      errorCount: result.errors?.length || 0,
      warningCount: result.warnings?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    if (this.validationHistory.length > 1000) {
      this.validationHistory = this.validationHistory.slice(-500);
    }
  }
  
  getValidationStats() {
    const stats = {
      total: this.validationHistory.length,
      valid: this.validationHistory.filter(v => v.valid).length,
      invalid: this.validationHistory.filter(v => !v.valid).length,
      byTool: {}
    };
    
    for (const entry of this.validationHistory) {
      if (!stats.byTool[entry.tool]) {
        stats.byTool[entry.tool] = { total: 0, valid: 0, invalid: 0 };
      }
      stats.byTool[entry.tool].total++;
      if (entry.valid) stats.byTool[entry.tool].valid++;
      else stats.byTool[entry.tool].invalid++;
    }
    
    return stats;
  }
}

export class ToolOrchestrator {
  constructor(projectPath = null, toolExecutor = null) {
    this.projectPath = projectPath;
    this.memory = new MemoryManager(projectPath);
    this.toolExecutor = toolExecutor;
    this.circuitBreaker = new CircuitBreaker(ORCHESTRATION_CONFIG.circuitBreakerThreshold);
    this.resourceLock = new ResourceLock();
    this.runningTools = new Map();
  }
  
  setProject(projectPath) {
    this.projectPath = projectPath;
    this.memory.setProject(projectPath);
  }
  
  setToolExecutor(executor) {
    this.toolExecutor = executor;
  }
  
  async executeWorkflow(workflow) {
    const workflowId = generateUUID();
    const results = [];
    const startTime = Date.now();
    
    const executionPlan = this.buildExecutionPlan(workflow.steps);
    
    for (const batch of executionPlan) {
      const batchResults = await this.executeBatch(batch, workflowId);
      results.push(...batchResults);
      
      const hasFailure = batchResults.some(r => !r.success && !r.skipped);
      if (hasFailure && !workflow.continueOnError) {
        break;
      }
    }
    
    return {
      workflowId,
      name: workflow.name,
      results,
      executionTime: Date.now() - startTime,
      success: results.every(r => r.success || r.skipped)
    };
  }
  
  buildExecutionPlan(steps) {
    const plan = [];
    let currentBatch = [];
    
    for (const step of steps) {
      if (step.parallel && currentBatch.length > 0 && currentBatch[0].parallel) {
        if (currentBatch.length < ORCHESTRATION_CONFIG.maxParallelTools) {
          currentBatch.push(step);
        } else {
          plan.push(currentBatch);
          currentBatch = [step];
        }
      } else {
        if (currentBatch.length > 0) {
          plan.push(currentBatch);
        }
        currentBatch = [step];
      }
    }
    
    if (currentBatch.length > 0) {
      plan.push(currentBatch);
    }
    
    return plan;
  }
  
  async executeBatch(batch, workflowId) {
    if (batch.length === 1) {
      const result = await this.executeTool(batch[0], workflowId);
      return [result];
    }
    
    const promises = batch.map(step => this.executeTool(step, workflowId));
    return Promise.all(promises);
  }
  
  async executeTool(step, workflowId) {
    const { tool, args = {}, timeout = ORCHESTRATION_CONFIG.toolTimeout } = step;
    const startTime = Date.now();
    
    if (this.circuitBreaker.isOpen(tool)) {
      return {
        tool,
        success: false,
        skipped: true,
        error: 'Circuit breaker open - tool temporarily disabled',
        executionTime: 0
      };
    }
    
    const validation = this.validateToolCall(tool, args);
    if (!validation.valid) {
      return {
        tool,
        success: false,
        skipped: true,
        error: validation.reason,
        executionTime: 0
      };
    }
    
    let lockId = null;
    if (args.filePath || args.dirPath) {
      try {
        lockId = await this.resourceLock.acquire(args.filePath || args.dirPath);
      } catch (err) {
        return {
          tool,
          success: false,
          error: `Resource lock failed: ${err.message}`,
          executionTime: Date.now() - startTime
        };
      }
    }
    
    try {
      const result = await this.executeWithTimeout(tool, args, timeout);
      
      this.circuitBreaker.recordSuccess(tool);
      
      if (this.projectPath) {
        await this.memory.recordToolExecution(
          tool,
          { workflowId, ...args },
          true,
          Date.now() - startTime
        );
      }
      
      return {
        tool,
        success: true,
        result,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      const isCircuitOpen = this.circuitBreaker.recordFailure(tool);
      
      if (this.projectPath) {
        await this.memory.recordError(
          tool,
          'tool_execution_error',
          error.message,
          { workflowId, ...args }
        );
      }
      
      return {
        tool,
        success: false,
        error: error.message,
        circuitBreakerTripped: isCircuitOpen,
        executionTime: Date.now() - startTime
      };
      
    } finally {
      if (lockId) {
        this.resourceLock.release(args.filePath || args.dirPath, lockId);
      }
    }
  }
  
  async executeWithTimeout(tool, args, timeout) {
    if (!this.toolExecutor) {
      throw new Error('No tool executor configured');
    }
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool ${tool} timed out after ${timeout}ms`));
      }, timeout);
      
      this.toolExecutor(tool, args)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  validateToolCall(tool, args) {
    for (const pattern of LEARNING_GUARDRAILS.forbiddenPatterns) {
      const argsStr = JSON.stringify(args).toLowerCase();
      if (argsStr.includes(pattern.toLowerCase())) {
        return { valid: false, reason: `Forbidden pattern: ${pattern}` };
      }
    }
    
    if (LEARNING_GUARDRAILS.requireHumanApproval.includes(tool)) {
      if (!args._approved) {
        return { valid: false, reason: `Tool ${tool} requires human approval` };
      }
    }
    
    return { valid: true };
  }
  
  async synthesizeResults(results) {
    const synthesis = {
      totalTools: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
      totalTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
      results: results.map(r => ({
        tool: r.tool,
        success: r.success,
        summary: r.result ? this.summarizeResult(r.result) : null,
        error: r.error
      }))
    };
    
    return synthesis;
  }
  
  summarizeResult(result) {
    if (typeof result === 'string') {
      return result.length > 200 ? result.substring(0, 200) + '...' : result;
    }
    if (result?.content?.[0]?.text) {
      const text = result.content[0].text;
      return text.length > 200 ? text.substring(0, 200) + '...' : text;
    }
    return JSON.stringify(result).substring(0, 200);
  }
  
  resetCircuitBreaker(toolName = null) {
    this.circuitBreaker.reset(toolName);
  }
  
  getCircuitBreakerStatus() {
    return Object.fromEntries(this.circuitBreaker.failures);
  }
}

export const WORKFLOWS = {
  full_code_review: {
    name: 'Full Code Review',
    description: 'Comprehensive code analysis including bugs, security, and performance',
    steps: [
      { tool: 'read_project', parallel: false },
      { tool: 'find_bugs', parallel: true },
      { tool: 'security_scan', parallel: true, args: { scanType: 'quick' } },
      { tool: 'optimize_code', parallel: true }
    ],
    continueOnError: true
  },
  
  security_audit: {
    name: 'Security Audit',
    description: 'Complete security scan of the codebase',
    steps: [
      { tool: 'security_scan', parallel: false, args: { scanType: 'full' } },
      { tool: 'secrets_scanner', parallel: true, args: { secretTypes: 'all' } },
      { tool: 'dependency_audit', parallel: true }
    ],
    continueOnError: true
  },
  
  performance_optimization: {
    name: 'Performance Optimization',
    description: 'Analyze and optimize code performance',
    steps: [
      { tool: 'analyze_directory', parallel: false, args: { analysisType: 'performance' } },
      { tool: 'optimize_code', parallel: false },
      { tool: 'memory_leak_detect', parallel: true },
      { tool: 'bundle_analysis', parallel: true }
    ],
    continueOnError: true
  },
  
  project_onboarding: {
    name: 'Project Onboarding',
    description: 'Analyze and understand a new project',
    steps: [
      { tool: 'read_project', parallel: false },
      { tool: 'analyze_directory', parallel: false, args: { analysisType: 'overview' } },
      { tool: 'architecture_review', parallel: false, args: { reviewType: 'all' } }
    ],
    continueOnError: false
  },
  
  refactoring_workflow: {
    name: 'Refactoring Workflow',
    description: 'Safe refactoring with analysis and testing',
    steps: [
      { tool: 'read_related_files', parallel: false },
      { tool: 'find_bugs', parallel: false },
      { tool: 'refactor_code', parallel: false },
      { tool: 'generate_tests', parallel: false }
    ],
    continueOnError: false
  }
};

export function getWorkflow(name) {
  return WORKFLOWS[name] || null;
}

export function listWorkflows() {
  return Object.entries(WORKFLOWS).map(([key, workflow]) => ({
    key,
    name: workflow.name,
    description: workflow.description,
    stepCount: workflow.steps.length
  }));
}
