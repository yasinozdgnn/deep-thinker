import { LEARNING_GUARDRAILS } from '../config.js';
import { MemoryManager } from '../memory/index.js';

export const ADAPTIVE_LEARNING_CONFIG = {
  learningRate: 0.1,
  minSamplesForAdaptation: 10,
  strategyUpdateInterval: 3600000,
  performanceThreshold: 0.7,
  patternMinOccurrences: 3,
  maxStrategiesPerTask: 5,
  decayFactor: 0.95
};

export class StrategyOptimizer {
  constructor(memory) {
    this.memory = memory;
    this.strategies = new Map();
    this.performanceHistory = new Map();
    this.lastUpdate = Date.now();
  }
  
  async learnBestStrategy(taskType, outcomes) {
    if (!outcomes || outcomes.length < ADAPTIVE_LEARNING_CONFIG.minSamplesForAdaptation) {
      return { learned: false, reason: 'Insufficient data for learning' };
    }
    
    const strategyScores = new Map();
    
    for (const outcome of outcomes) {
      const strategy = outcome.strategy || outcome.tool;
      const score = this.calculateScore(outcome);
      
      const current = strategyScores.get(strategy) || { totalScore: 0, count: 0, successes: 0 };
      current.totalScore += score;
      current.count++;
      if (outcome.success) current.successes++;
      strategyScores.set(strategy, current);
    }
    
    let bestStrategy = null;
    let bestScore = -Infinity;
    
    for (const [strategy, data] of strategyScores) {
      const avgScore = data.totalScore / data.count;
      const successRate = data.successes / data.count;
      const combinedScore = avgScore * 0.6 + successRate * 40;
      
      if (combinedScore > bestScore && data.count >= 3) {
        bestScore = combinedScore;
        bestStrategy = {
          name: strategy,
          avgScore,
          successRate,
          sampleSize: data.count
        };
      }
    }
    
    if (bestStrategy) {
      const existing = this.strategies.get(taskType) || [];
      existing.push({
        ...bestStrategy,
        learnedAt: new Date().toISOString()
      });
      
      if (existing.length > ADAPTIVE_LEARNING_CONFIG.maxStrategiesPerTask) {
        existing.shift();
      }
      
      this.strategies.set(taskType, existing);
    }
    
    return {
      learned: !!bestStrategy,
      strategy: bestStrategy,
      alternatives: Array.from(strategyScores.entries())
        .filter(([s]) => s !== bestStrategy?.name)
        .map(([s, d]) => ({ name: s, successRate: d.successes / d.count, samples: d.count }))
        .slice(0, 3)
    };
  }
  
  calculateScore(outcome) {
    let score = 0;
    
    if (outcome.success) score += 50;
    
    if (outcome.executionTime) {
      const timeScore = Math.max(0, 30 - outcome.executionTime / 1000);
      score += timeScore;
    }
    
    if (outcome.retries) {
      score -= outcome.retries * 5;
    }
    
    if (outcome.quality) {
      score += outcome.quality * 20;
    }
    
    return score;
  }
  
  async adaptStrategy(context, performance) {
    const taskType = context.taskType || context.tool || 'general';
    
    this.recordPerformance(taskType, performance);
    
    const history = this.performanceHistory.get(taskType) || [];
    
    if (history.length < ADAPTIVE_LEARNING_CONFIG.minSamplesForAdaptation) {
      return { adapted: false, reason: 'Building performance baseline' };
    }
    
    const recentPerformance = this.calculateAveragePerformance(history.slice(-10));
    const overallPerformance = this.calculateAveragePerformance(history);
    
    if (recentPerformance < overallPerformance * 0.8) {
      const suggestion = await this.suggestAlternativeStrategy(taskType, context);
      
      return {
        adapted: true,
        reason: 'Performance degradation detected',
        currentPerformance: recentPerformance,
        historicalPerformance: overallPerformance,
        suggestion
      };
    }
    
    return {
      adapted: false,
      reason: 'Performance is stable',
      currentPerformance: recentPerformance,
      historicalPerformance: overallPerformance
    };
  }
  
  recordPerformance(taskType, performance) {
    const history = this.performanceHistory.get(taskType) || [];
    history.push({
      ...performance,
      timestamp: Date.now()
    });
    
    if (history.length > 100) {
      for (let i = 0; i < 50; i++) {
        history[i].score *= ADAPTIVE_LEARNING_CONFIG.decayFactor;
      }
      history.splice(0, 25);
    }
    
    this.performanceHistory.set(taskType, history);
  }
  
  calculateAveragePerformance(history) {
    if (!history || history.length === 0) return 0;
    
    const scores = history.map(h => {
      let score = 0;
      if (h.success) score += 50;
      if (h.executionTime) score += Math.max(0, 30 - h.executionTime / 1000);
      if (h.retries) score -= h.retries * 5;
      return score;
    });
    
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  
  async suggestAlternativeStrategy(taskType, context) {
    const strategies = this.strategies.get(taskType) || [];
    
    if (strategies.length > 0) {
      const best = strategies.reduce((a, b) => 
        (a.successRate * a.sampleSize) > (b.successRate * b.sampleSize) ? a : b
      );
      return {
        type: 'use_historical_best',
        strategy: best.name,
        confidence: best.successRate,
        basedOn: best.sampleSize
      };
    }
    
    const similarTasks = await this.findSimilarTaskStrategies(taskType);
    if (similarTasks.length > 0) {
      return {
        type: 'use_similar_task',
        strategy: similarTasks[0].strategy,
        similarTo: similarTasks[0].taskType,
        confidence: similarTasks[0].successRate * 0.8
      };
    }
    
    return {
      type: 'use_default',
      strategy: 'deep_think_chat',
      confidence: 0.5
    };
  }
  
  async findSimilarTaskStrategies(taskType) {
    const similar = [];
    const taskWords = taskType.toLowerCase().split(/[_\s-]+/);
    
    for (const [type, strategies] of this.strategies) {
      if (type === taskType) continue;
      
      const typeWords = type.toLowerCase().split(/[_\s-]+/);
      const commonWords = taskWords.filter(w => typeWords.includes(w));
      
      if (commonWords.length > 0 && strategies.length > 0) {
        const best = strategies.reduce((a, b) => a.successRate > b.successRate ? a : b);
        similar.push({
          taskType: type,
          strategy: best.name,
          successRate: best.successRate,
          similarity: commonWords.length / Math.max(taskWords.length, typeWords.length)
        });
      }
    }
    
    return similar.sort((a, b) => b.similarity - a.similarity);
  }
  
  async compareStrategies(strategyA, strategyB, task) {
    const historyA = this.performanceHistory.get(`${task}_${strategyA}`) || [];
    const historyB = this.performanceHistory.get(`${task}_${strategyB}`) || [];
    
    const perfA = this.calculateAveragePerformance(historyA);
    const perfB = this.calculateAveragePerformance(historyB);
    
    return {
      strategyA: {
        name: strategyA,
        performance: perfA,
        samples: historyA.length
      },
      strategyB: {
        name: strategyB,
        performance: perfB,
        samples: historyB.length
      },
      winner: perfA > perfB ? strategyA : perfB > perfA ? strategyB : 'tie',
      confidence: Math.abs(perfA - perfB) / Math.max(perfA, perfB, 1),
      recommendation: historyA.length < 5 || historyB.length < 5 
        ? 'Need more data for reliable comparison' 
        : `Use ${perfA > perfB ? strategyA : strategyB}`
    };
  }
  
  predictPerformance(strategy, context) {
    const taskType = context.taskType || 'general';
    const key = `${taskType}_${strategy}`;
    const history = this.performanceHistory.get(key) || [];
    
    if (history.length < 3) {
      return {
        predicted: false,
        reason: 'Insufficient historical data',
        defaultEstimate: 50
      };
    }
    
    const recentHistory = history.slice(-10);
    const avgPerformance = this.calculateAveragePerformance(recentHistory);
    
    const successRate = recentHistory.filter(h => h.success).length / recentHistory.length;
    const avgTime = recentHistory.reduce((sum, h) => sum + (h.executionTime || 0), 0) / recentHistory.length;
    
    return {
      predicted: true,
      estimatedScore: avgPerformance,
      estimatedSuccessRate: successRate,
      estimatedTime: avgTime,
      confidence: Math.min(history.length / 20, 1),
      basedOnSamples: recentHistory.length
    };
  }
  
  getStrategies(taskType = null) {
    if (taskType) {
      return this.strategies.get(taskType);
    }
    return Object.fromEntries(this.strategies);
  }
}

export class PatternLearner {
  constructor(memory) {
    this.memory = memory;
    this.successPatterns = new Map();
    this.errorPatterns = new Map();
    this.recommendations = [];
  }
  
  async learnSuccessPatterns(executions) {
    const patterns = new Map();
    
    const successes = executions.filter(e => e.success);
    
    for (const exec of successes) {
      const patternKey = this.extractPatternKey(exec);
      const existing = patterns.get(patternKey) || { count: 0, avgTime: 0, examples: [] };
      
      existing.count++;
      existing.avgTime = (existing.avgTime * (existing.count - 1) + (exec.executionTime || 0)) / existing.count;
      
      if (existing.examples.length < 3) {
        existing.examples.push({
          tool: exec.tool,
          context: this.summarizeContext(exec.context),
          time: exec.executionTime
        });
      }
      
      patterns.set(patternKey, existing);
    }
    
    for (const [key, pattern] of patterns) {
      if (pattern.count >= ADAPTIVE_LEARNING_CONFIG.patternMinOccurrences) {
        this.successPatterns.set(key, {
          ...pattern,
          learnedAt: new Date().toISOString()
        });
      }
    }
    
    return {
      patternsLearned: this.successPatterns.size,
      topPatterns: Array.from(this.successPatterns.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([key, p]) => ({ pattern: key, occurrences: p.count, avgTime: p.avgTime }))
    };
  }
  
  async detectErrorPatterns(failures) {
    const patterns = new Map();
    
    for (const failure of failures) {
      const errorType = this.classifyErrorPattern(failure);
      const patternKey = `${failure.tool}_${errorType}`;
      
      const existing = patterns.get(patternKey) || { 
        count: 0, 
        tool: failure.tool,
        errorType,
        contexts: [],
        resolutions: []
      };
      
      existing.count++;
      
      if (existing.contexts.length < 5) {
        existing.contexts.push(this.summarizeContext(failure.context));
      }
      
      if (failure.resolution && !existing.resolutions.includes(failure.resolution)) {
        existing.resolutions.push(failure.resolution);
      }
      
      patterns.set(patternKey, existing);
    }
    
    for (const [key, pattern] of patterns) {
      if (pattern.count >= ADAPTIVE_LEARNING_CONFIG.patternMinOccurrences) {
        this.errorPatterns.set(key, {
          ...pattern,
          detectedAt: new Date().toISOString()
        });
      }
    }
    
    return {
      errorPatternsDetected: this.errorPatterns.size,
      criticalPatterns: Array.from(this.errorPatterns.entries())
        .filter(([, p]) => p.count >= 5)
        .map(([key, p]) => ({ 
          pattern: key, 
          occurrences: p.count,
          suggestedResolutions: p.resolutions
        }))
    };
  }
  
  extractPatternKey(execution) {
    const parts = [execution.tool];
    
    if (execution.context?.taskType) {
      parts.push(execution.context.taskType);
    }
    
    if (execution.context?.filePath) {
      const ext = execution.context.filePath.split('.').pop();
      parts.push(`file_${ext}`);
    }
    
    return parts.join('_');
  }
  
  classifyErrorPattern(failure) {
    const message = (failure.error || failure.message || '').toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('permission') || message.includes('access')) return 'permission';
    if (message.includes('not found') || message.includes('enoent')) return 'not_found';
    if (message.includes('syntax') || message.includes('parse')) return 'syntax';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('rate') || message.includes('limit')) return 'rate_limit';
    if (message.includes('memory') || message.includes('heap')) return 'memory';
    
    return 'unknown';
  }
  
  summarizeContext(context) {
    if (!context) return {};
    
    const summary = {};
    
    if (context.filePath) {
      summary.fileType = context.filePath.split('.').pop();
    }
    if (context.taskType) {
      summary.taskType = context.taskType;
    }
    if (context.tool) {
      summary.tool = context.tool;
    }
    
    return summary;
  }
  
  async generateRecommendations() {
    this.recommendations = [];
    
    for (const [key, pattern] of this.errorPatterns) {
      if (pattern.count >= 5) {
        this.recommendations.push({
          type: 'avoid_pattern',
          priority: 'high',
          pattern: key,
          tool: pattern.tool,
          errorType: pattern.errorType,
          suggestion: `Consider alternative approach for ${pattern.tool} - ${pattern.count} failures detected`,
          resolutions: pattern.resolutions
        });
      }
    }
    
    for (const [key, pattern] of this.successPatterns) {
      if (pattern.count >= 10 && pattern.avgTime < 5000) {
        this.recommendations.push({
          type: 'prefer_pattern',
          priority: 'medium',
          pattern: key,
          suggestion: `Pattern "${key}" is highly effective (${pattern.count} successes, avg ${Math.round(pattern.avgTime)}ms)`,
          examples: pattern.examples
        });
      }
    }
    
    return this.recommendations;
  }
  
  getSuccessPatterns() {
    return Object.fromEntries(this.successPatterns);
  }
  
  getErrorPatterns() {
    return Object.fromEntries(this.errorPatterns);
  }
  
  matchesSuccessPattern(execution) {
    const key = this.extractPatternKey(execution);
    return this.successPatterns.has(key);
  }
  
  matchesErrorPattern(tool, errorType) {
    const key = `${tool}_${errorType}`;
    return this.errorPatterns.get(key);
  }
}


export class SelfImprovement {
  constructor(projectPath = null) {
    this.projectPath = projectPath;
    this.memory = new MemoryManager(projectPath);
    this.sessionStrategies = new Map();
    this.strategyChangesThisSession = 0;
  }
  
  setProject(projectPath) {
    this.projectPath = projectPath;
    this.memory.setProject(projectPath);
  }
  
  async learnFromExecution(toolName, input, output, success, executionTime) {
    if (!this.projectPath) return;
    
    const inputSummary = this.summarize(input);
    const outputSummary = this.summarize(output);
    
    await this.memory.recordToolExecution(
      toolName,
      { inputType: typeof input, hasFilePath: !!input?.filePath },
      success,
      executionTime,
      inputSummary,
      outputSummary
    );
    
    if (!success) {
      await this.analyzeFailure(toolName, input, output);
    }
  }
  
  async analyzeFailure(toolName, input, error) {
    const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
    const errorType = this.classifyError(errorMessage);
    
    await this.memory.recordError(
      toolName,
      errorType,
      errorMessage,
      { input },
      this.suggestResolution(errorType, errorMessage)
    );
    
    const successRate = await this.memory.getToolSuccessRate(toolName);
    
    if (successRate < LEARNING_GUARDRAILS.confidenceThreshold) {
      this.flagToolForReview(toolName, successRate);
    }
  }
  
  classifyError(errorMessage) {
    const lowerMessage = errorMessage.toLowerCase();
    
    if (lowerMessage.includes('timeout')) return 'timeout';
    if (lowerMessage.includes('permission') || lowerMessage.includes('access denied')) return 'permission';
    if (lowerMessage.includes('not found') || lowerMessage.includes('enoent')) return 'file_not_found';
    if (lowerMessage.includes('syntax')) return 'syntax_error';
    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) return 'network';
    if (lowerMessage.includes('memory') || lowerMessage.includes('heap')) return 'memory';
    if (lowerMessage.includes('api') || lowerMessage.includes('rate limit')) return 'api_error';
    
    return 'unknown';
  }
  
  suggestResolution(errorType, errorMessage) {
    const resolutions = {
      timeout: 'Increase timeout or break task into smaller chunks',
      permission: 'Check file/directory permissions',
      file_not_found: 'Verify file path exists before operation',
      syntax_error: 'Review code syntax and structure',
      network: 'Check network connectivity or retry later',
      memory: 'Reduce batch size or optimize memory usage',
      api_error: 'Check API limits or credentials',
      unknown: 'Review error details and context'
    };
    
    return resolutions[errorType] || resolutions.unknown;
  }
  
  flagToolForReview(toolName, successRate) {
    this.memory.setSessionVariable(`flagged_tool_${toolName}`, {
      successRate,
      flaggedAt: new Date().toISOString(),
      reason: 'Low success rate'
    });
  }
  
  async adaptStrategy(taskType, context = {}) {
    if (this.strategyChangesThisSession >= LEARNING_GUARDRAILS.maxStrategyChangesPerSession) {
      return {
        adapted: false,
        reason: 'Maximum strategy changes reached for this session'
      };
    }
    
    const bestTool = await this.memory.getBestToolForTask(taskType);
    
    if (!bestTool) {
      return {
        adapted: false,
        reason: 'No historical data for this task type'
      };
    }
    
    const confidence = bestTool.total > 0 
      ? bestTool.successes / bestTool.total 
      : 0;
    
    if (confidence < LEARNING_GUARDRAILS.confidenceThreshold) {
      return {
        adapted: false,
        reason: `Confidence too low (${(confidence * 100).toFixed(1)}%)`,
        suggestedTool: bestTool.tool_name
      };
    }
    
    this.sessionStrategies.set(taskType, {
      tool: bestTool.tool_name,
      confidence,
      avgTime: bestTool.avg_time,
      adoptedAt: new Date().toISOString()
    });
    
    this.strategyChangesThisSession++;
    
    return {
      adapted: true,
      tool: bestTool.tool_name,
      confidence,
      avgTime: bestTool.avg_time
    };
  }
  
  async suggestOptimization(context) {
    const suggestions = [];
    
    if (this.projectPath) {
      const stats = await this.memory.getToolStats();
      
      for (const stat of stats || []) {
        if (stat.total_calls > 5) {
          const successRate = stat.success_count / stat.total_calls;
          
          if (successRate < 0.7) {
            suggestions.push({
              type: 'tool_reliability',
              tool: stat.tool_name,
              message: `${stat.tool_name} has ${(successRate * 100).toFixed(0)}% success rate`,
              recommendation: 'Consider using alternative tool or reviewing usage patterns'
            });
          }
          
          if (stat.avg_execution_time > 10000) {
            suggestions.push({
              type: 'performance',
              tool: stat.tool_name,
              message: `${stat.tool_name} average time: ${(stat.avg_execution_time / 1000).toFixed(1)}s`,
              recommendation: 'Consider breaking into smaller tasks'
            });
          }
        }
      }
      
      const errors = await this.memory.learning?.getRecentErrors(null, 20);
      const errorCounts = {};
      
      for (const error of errors || []) {
        errorCounts[error.error_type] = (errorCounts[error.error_type] || 0) + 1;
      }
      
      for (const [errorType, count] of Object.entries(errorCounts)) {
        if (count >= 3) {
          suggestions.push({
            type: 'recurring_error',
            errorType,
            count,
            message: `${errorType} errors occurred ${count} times recently`,
            recommendation: this.suggestResolution(errorType, '')
          });
        }
      }
    }
    
    return suggestions;
  }
  
  async getPerformanceReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      projectId: this.memory.projectId,
      sessionStats: {
        strategyChanges: this.strategyChangesThisSession,
        adoptedStrategies: Object.fromEntries(this.sessionStrategies)
      }
    };
    
    if (this.projectPath) {
      const stats = await this.memory.getToolStats();
      
      report.toolPerformance = (stats || []).map(s => ({
        tool: s.tool_name,
        calls: s.total_calls,
        successRate: s.total_calls > 0 
          ? `${(s.success_count / s.total_calls * 100).toFixed(1)}%` 
          : 'N/A',
        avgTime: s.avg_execution_time 
          ? `${(s.avg_execution_time / 1000).toFixed(2)}s` 
          : 'N/A',
        lastUsed: s.last_used
      }));
      
      const insights = await this.memory.getInsights('all');
      report.insights = insights;
    }
    
    return report;
  }
  
  async validateAction(toolName, args) {
    for (const pattern of LEARNING_GUARDRAILS.forbiddenPatterns) {
      const argsStr = JSON.stringify(args).toLowerCase();
      if (argsStr.includes(pattern.toLowerCase())) {
        return {
          valid: false,
          reason: `Forbidden pattern detected: ${pattern}`,
          blocked: true
        };
      }
    }
    
    if (LEARNING_GUARDRAILS.requireHumanApproval.includes(toolName)) {
      return {
        valid: true,
        requiresApproval: true,
        reason: `Tool ${toolName} requires human approval`
      };
    }
    
    if (this.projectPath) {
      const successRate = await this.memory.getToolSuccessRate(toolName);
      
      if (successRate < 0.5 && successRate > 0) {
        return {
          valid: true,
          warning: true,
          reason: `Tool ${toolName} has low success rate (${(successRate * 100).toFixed(0)}%)`
        };
      }
    }
    
    return { valid: true };
  }
  
  async shouldRetry(toolName, error, attemptNumber) {
    if (attemptNumber >= LEARNING_GUARDRAILS.rollbackWindow) {
      return { retry: false, reason: 'Maximum retry attempts reached' };
    }
    
    const errorType = this.classifyError(error?.message || error);
    
    const noRetryErrors = ['permission', 'file_not_found', 'syntax_error'];
    if (noRetryErrors.includes(errorType)) {
      return { 
        retry: false, 
        reason: `Error type ${errorType} is not retryable`,
        suggestion: this.suggestResolution(errorType, error?.message || error)
      };
    }
    
    const retryableErrors = ['timeout', 'network', 'api_error'];
    if (retryableErrors.includes(errorType)) {
      return {
        retry: true,
        delay: Math.pow(2, attemptNumber) * 1000,
        reason: `Error type ${errorType} is retryable`
      };
    }
    
    return { retry: false, reason: 'Unknown error type' };
  }
  
  summarize(data, maxLength = 100) {
    if (data === null || data === undefined) return '';
    if (typeof data === 'string') {
      return data.length > maxLength ? data.substring(0, maxLength) + '...' : data;
    }
    const str = JSON.stringify(data);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }
  
  resetSession() {
    this.sessionStrategies.clear();
    this.strategyChangesThisSession = 0;
  }
}
