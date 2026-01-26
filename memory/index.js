import { ProjectMemory, LearningMemory, CheckpointManager, closeDatabase } from './persistent.js';
import { SessionMemory } from './session.js';
import { generateProjectId } from '../config.js';

export class MemoryManager {
  constructor(projectPath = null) {
    this.projectPath = projectPath;
    this.projectId = projectPath ? generateProjectId(projectPath) : null;
    
    this.project = projectPath ? new ProjectMemory(projectPath) : null;
    this.learning = projectPath ? new LearningMemory(projectPath) : null;
    this.checkpoint = projectPath ? new CheckpointManager(projectPath) : null;
    this.session = new SessionMemory();
  }
  
  setProject(projectPath) {
    this.projectPath = projectPath;
    this.projectId = generateProjectId(projectPath);
    this.project = new ProjectMemory(projectPath);
    this.learning = new LearningMemory(projectPath);
    this.checkpoint = new CheckpointManager(projectPath);
  }
  
  async registerProject(info = {}) {
    if (!this.project) {
      throw new Error('No project path set');
    }
    return await this.project.register(info);
  }
  
  async getProjectInfo() {
    if (!this.project) return null;
    return await this.project.getInfo();
  }

  async recordPlan(plan) {
    if (this.project) {
      await this.project.recordPlan(plan);
    }
  }

  async updatePlanProgress(planId, status, currentStep) {
    if (this.project) {
      await this.project.updatePlanProgress(planId, status, currentStep);
    }
  }
  
  async recordToolExecution(toolName, context, success, executionTime, inputSummary = '', outputSummary = '') {
    this.session.addToHistory({
      type: 'tool_execution',
      toolName,
      success,
      executionTime
    });
    
    if (this.learning) {
      await this.learning.recordToolUsage(toolName, context, success, executionTime, inputSummary, outputSummary);
    }
  }
  
  async recordError(toolName, errorType, errorMessage, context, resolution = null) {
    this.session.addToHistory({
      type: 'error',
      toolName,
      errorType,
      errorMessage
    });
    
    if (this.learning) {
      await this.learning.recordError(toolName, errorType, errorMessage, context, resolution);
    }
  }
  
  async getToolStats(toolName = null) {
    if (!this.learning) return null;
    return await this.learning.getToolStats(toolName);
  }
  
  async getToolSuccessRate(toolName) {
    if (!this.learning) return 1.0;
    return await this.learning.getSuccessRate(toolName);
  }
  
  async getSimilarPatterns(toolName, context, limit = 5) {
    if (!this.learning) return [];
    return await this.learning.getSimilarPatterns(toolName, context, limit);
  }
  
  async getBestToolForTask(taskType) {
    if (!this.learning) return null;
    return await this.learning.getBestToolForTask(taskType);
  }
  
  async saveCheckpoint(planId, stepIndex, state, fileSnapshots = {}) {
    if (!this.checkpoint) {
      throw new Error('No project path set');
    }
    return await this.checkpoint.save(planId, stepIndex, state, fileSnapshots);
  }
  
  async loadCheckpoint(checkpointId) {
    if (!this.checkpoint) return null;
    return await this.checkpoint.load(checkpointId);
  }
  
  async getLatestCheckpoint(planId) {
    if (!this.checkpoint) return null;
    return await this.checkpoint.getLatest(planId);
  }
  
  setSessionTask(task) {
    this.session.setCurrentTask(task);
  }
  
  clearSessionTask() {
    this.session.clearCurrentTask();
  }
  
  setActivePlan(plan) {
    this.session.setActivePlan(plan);
  }
  
  getActivePlan() {
    return this.session.getActivePlan();
  }
  
  setSessionVariable(key, value) {
    this.session.setVariable(key, value);
  }
  
  getSessionVariable(key, defaultValue = null) {
    return this.session.getVariable(key, defaultValue);
  }
  
  setSessionContext(key, value) {
    this.session.setContext(key, value);
  }
  
  getSessionContext(key = null) {
    return this.session.getContext(key);
  }
  
  getRecentHistory(count = 10) {
    return this.session.getRecentHistory(count);
  }
  
  saveSession() {
    return this.session.save();
  }
  
  async getInsights(topic = 'all') {
    const insights = {
      topic,
      projectId: this.projectId,
      generatedAt: new Date().toISOString()
    };
    
    if (!this.learning) {
      return { ...insights, message: 'No project context available' };
    }
    
    if (topic === 'tools' || topic === 'all') {
      const stats = await this.learning.getToolStats();
      insights.toolStats = stats.map(s => ({
        name: s.tool_name,
        totalCalls: s.total_calls,
        successRate: s.total_calls > 0 ? (s.success_count / s.total_calls * 100).toFixed(1) + '%' : 'N/A',
        avgTime: s.avg_execution_time ? Math.round(s.avg_execution_time) + 'ms' : 'N/A'
      }));
    }
    
    if (topic === 'errors' || topic === 'all') {
      const errors = await this.learning.getRecentErrors(null, 10);
      insights.recentErrors = errors.map(e => ({
        tool: e.tool_name,
        type: e.error_type,
        message: e.error_message,
        resolution: e.resolution,
        date: e.created_at
      }));
    }
    
    if (topic === 'patterns' || topic === 'all') {
      insights.sessionHistory = this.session.getRecentHistory(20);
    }
    
    return insights;
  }
  
  destroy() {
    this.session.destroy();
  }
  
  static cleanup() {
    SessionMemory.cleanup();
    closeDatabase();
  }
}

export { ProjectMemory, LearningMemory, CheckpointManager, SessionMemory };
