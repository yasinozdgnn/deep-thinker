import crypto from 'crypto';
import path from 'path';

export const MEMORY_CONFIG = {
  maxProjectMemorySize: 5 * 1024 * 1024,
  maxSessionHistory: 50,
  maxPatternCount: 200,
  pruneThreshold: 0.8,
  compressionEnabled: true,
  indexFields: ['projectId', 'toolName', 'timestamp']
};

export const LEARNING_GUARDRAILS = {
  maxStrategyChangesPerSession: 3,
  confidenceThreshold: 0.85,
  requireHumanApproval: ['write_file', 'refactor_code', 'security_scan'],
  forbiddenPatterns: ['delete', 'drop', 'truncate', 'rm -rf', 'rmdir'],
  rollbackWindow: 5,
  dryRunFirst: true
};

export const ORCHESTRATION_CONFIG = {
  maxParallelTools: 3,
  toolTimeout: 3600000,
  maxRetries: 2,
  circuitBreakerThreshold: 3,
  dependencyResolutionTimeout: 10000,
  deadlockDetectionInterval: 2000
};

export const CHECKPOINT_CONFIG = {
  autoCheckpointInterval: 3,
  maxCheckpoints: 10,
  validateBeforeRestore: true,
  atomicOperations: true
};

export function generateProjectId(projectPath) {
  const normalized = path.normalize(projectPath).toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

export function generateUUID() {
  return crypto.randomUUID();
}
