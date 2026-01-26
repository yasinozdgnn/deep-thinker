import { generateUUID } from '../config.js';
import { MemoryManager } from '../memory/index.js';
import { CHECKPOINT_CONFIG, LEARNING_GUARDRAILS } from '../config.js';
import path from 'node:path';

export class TaskPlanner {
  constructor(projectPath = null) {
    this.projectPath = projectPath;
    this.memory = new MemoryManager(projectPath);
    this.currentPlan = null;
  }
  
  setProject(projectPath) {
    this.projectPath = projectPath;
    this.memory.setProject(projectPath);
  }
  
  async createPlan(goal, context = {}) {
    if (this.projectPath) {
      await this.memory.registerProject({ name: path.basename(this.projectPath) });
    }
    const planId = generateUUID();
    
    const plan = {
      id: planId,
      goal,
      context,
      status: 'pending',
      steps: [],
      currentStepIndex: 0,
      checkpoints: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      error: null
    };
    
    this.currentPlan = plan;
    this.memory.setActivePlan(plan);
    
    return plan;
  }
  
  addStep(step) {
    if (!this.currentPlan) {
      throw new Error('No active plan. Call createPlan first.');
    }
    
    const stepWithId = {
      id: this.currentPlan.steps.length + 1,
      ...step,
      status: 'pending',
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
      retryCount: 0
    };
    
    this.currentPlan.steps.push(stepWithId);
    this.currentPlan.updatedAt = new Date().toISOString();
    
    return stepWithId;
  }
  
  addSteps(steps) {
    return steps.map(step => this.addStep(step));
  }
  
  async startPlan() {
    if (!this.currentPlan) {
      throw new Error('No active plan');
    }
    
    this.currentPlan.status = 'in_progress';
    this.currentPlan.updatedAt = new Date().toISOString();
    
    return this.currentPlan;
  }
  
  getCurrentStep() {
    if (!this.currentPlan) return null;
    return this.currentPlan.steps[this.currentPlan.currentStepIndex] || null;
  }
  
  async markStepStarted(stepIndex = null) {
    const index = stepIndex ?? this.currentPlan.currentStepIndex;
    const step = this.currentPlan.steps[index];
    
    if (!step) {
      throw new Error(`Step ${index} not found`);
    }
    
    step.status = 'in_progress';
    step.startedAt = new Date().toISOString();
    this.currentPlan.updatedAt = new Date().toISOString();
    
    return step;
  }
  
  async markStepCompleted(stepIndex = null, result = null) {
    const index = stepIndex ?? this.currentPlan.currentStepIndex;
    const step = this.currentPlan.steps[index];
    
    if (!step) {
      throw new Error(`Step ${index} not found`);
    }
    
    step.status = 'completed';
    step.result = result;
    step.completedAt = new Date().toISOString();
    this.currentPlan.updatedAt = new Date().toISOString();
    
    if (this.projectPath) {
      await this.memory.recordToolExecution(
        step.tool,
        { planId: this.currentPlan.id, stepIndex: index, ...step.args },
        true,
        step.completedAt && step.startedAt 
          ? new Date(step.completedAt) - new Date(step.startedAt) 
          : 0
      );
    }
    
    if (this.shouldAutoCheckpoint(index)) {
      await this.checkpoint();
    }
    
    return step;
  }
  
  async markStepFailed(stepIndex = null, error = null) {
    const index = stepIndex ?? this.currentPlan.currentStepIndex;
    const step = this.currentPlan.steps[index];
    
    if (!step) {
      throw new Error(`Step ${index} not found`);
    }
    
    step.status = 'failed';
    step.error = error;
    step.completedAt = new Date().toISOString();
    step.retryCount++;
    this.currentPlan.updatedAt = new Date().toISOString();
    
    if (this.projectPath) {
      await this.memory.recordError(
        step.tool,
        'step_failure',
        typeof error === 'string' ? error : error?.message || 'Unknown error',
        { planId: this.currentPlan.id, stepIndex: index, ...step.args }
      );
    }
    
    return step;
  }
  
  async nextStep() {
    if (!this.currentPlan) {
      throw new Error('No active plan');
    }
    
    this.currentPlan.currentStepIndex++;
    
    if (this.currentPlan.currentStepIndex >= this.currentPlan.steps.length) {
      return this.completePlan();
    }
    
    return this.getCurrentStep();
  }
  
  async completePlan() {
    if (!this.currentPlan) return null;
    
    this.currentPlan.status = 'completed';
    this.currentPlan.completedAt = new Date().toISOString();
    this.currentPlan.updatedAt = new Date().toISOString();
    
    const plan = { ...this.currentPlan };
    this.memory.clearSessionTask();
    
    return plan;
  }
  
  async failPlan(error) {
    if (!this.currentPlan) return null;
    
    this.currentPlan.status = 'failed';
    this.currentPlan.error = error;
    this.currentPlan.updatedAt = new Date().toISOString();
    
    return this.currentPlan;
  }
  
  shouldAutoCheckpoint(stepIndex) {
    return (stepIndex + 1) % CHECKPOINT_CONFIG.autoCheckpointInterval === 0;
  }
  
  async checkpoint(fileSnapshots = {}) {
    if (!this.currentPlan || !this.projectPath) return null;
    
    const state = {
      plan: this.currentPlan,
      sessionContext: this.memory.getSessionContext()
    };
    
    const checkpointId = await this.memory.saveCheckpoint(
      this.currentPlan.id,
      this.currentPlan.currentStepIndex,
      state,
      fileSnapshots
    );
    
    this.currentPlan.checkpoints.push({
      id: checkpointId,
      stepIndex: this.currentPlan.currentStepIndex,
      createdAt: new Date().toISOString()
    });
    
    return checkpointId;
  }
  
  async restoreFromCheckpoint(checkpointId = null) {
    if (!this.projectPath) {
      throw new Error('No project path set');
    }
    
    let checkpoint;
    
    if (checkpointId) {
      checkpoint = await this.memory.loadCheckpoint(checkpointId);
    } else if (this.currentPlan) {
      checkpoint = await this.memory.getLatestCheckpoint(this.currentPlan.id);
    }
    
    if (!checkpoint) {
      throw new Error('No checkpoint found');
    }
    
    if (CHECKPOINT_CONFIG.validateBeforeRestore && !checkpoint.isValid) {
      throw new Error('Checkpoint validation failed - data may be corrupted');
    }
    
    this.currentPlan = checkpoint.state.plan;
    
    for (const [key, value] of Object.entries(checkpoint.state.sessionContext || {})) {
      this.memory.setSessionContext(key, value);
    }
    
    return {
      restoredTo: checkpoint.stepIndex,
      plan: this.currentPlan,
      fileSnapshots: checkpoint.fileSnapshots
    };
  }
  
  async retryStep(stepIndex = null) {
    const index = stepIndex ?? this.currentPlan.currentStepIndex;
    const step = this.currentPlan.steps[index];
    
    if (!step) {
      throw new Error(`Step ${index} not found`);
    }
    
    step.status = 'pending';
    step.error = null;
    step.startedAt = null;
    step.completedAt = null;
    
    return step;
  }
  
  async skipStep(stepIndex = null) {
    const index = stepIndex ?? this.currentPlan.currentStepIndex;
    const step = this.currentPlan.steps[index];
    
    if (!step) {
      throw new Error(`Step ${index} not found`);
    }
    
    step.status = 'skipped';
    step.completedAt = new Date().toISOString();
    
    return this.nextStep();
  }
  
  canRetry(stepIndex = null) {
    const index = stepIndex ?? this.currentPlan?.currentStepIndex;
    const step = this.currentPlan?.steps[index];
    
    if (!step) return false;
    return step.retryCount < (step.maxRetries || 2);
  }
  
  getProgress() {
    if (!this.currentPlan) return null;
    
    const total = this.currentPlan.steps.length;
    const completed = this.currentPlan.steps.filter(s => s.status === 'completed').length;
    const failed = this.currentPlan.steps.filter(s => s.status === 'failed').length;
    const skipped = this.currentPlan.steps.filter(s => s.status === 'skipped').length;
    
    return {
      total,
      completed,
      failed,
      skipped,
      pending: total - completed - failed - skipped,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      currentStep: this.currentPlan.currentStepIndex + 1
    };
  }
  
  getPlan() {
    return this.currentPlan;
  }
  
  getSteps() {
    return this.currentPlan?.steps || [];
  }
  
  validateStep(step) {
    if (!step.tool) {
      return { valid: false, reason: 'Step must have a tool' };
    }
    
    for (const pattern of LEARNING_GUARDRAILS.forbiddenPatterns) {
      const argsStr = JSON.stringify(step.args || {}).toLowerCase();
      if (argsStr.includes(pattern.toLowerCase())) {
        return { valid: false, reason: `Forbidden pattern detected: ${pattern}` };
      }
    }
    
    return { valid: true };
  }
  
  toJSON() {
    return this.currentPlan;
  }
}

// Export singleton instance for state persistence
export const taskPlanner = new TaskPlanner();
