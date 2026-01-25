import { coreHandlers } from './core.js';
import { fileOpsHandlers } from './file-ops.js';
import { codeAnalysisHandlers } from './code-analysis.js';
import { gitOpsHandlers } from './git-ops.js';
import { executionHandlers } from './execution.js';
import { swarmHandlers } from './swarm.js';
import { memoryHandlers } from './memory.js';
import { watcherHandlers } from './watcher.js';

export const handlers = {
  ...coreHandlers,
  ...fileOpsHandlers,
  ...codeAnalysisHandlers,
  ...gitOpsHandlers,
  ...executionHandlers,
  ...swarmHandlers,
  ...memoryHandlers,
  ...watcherHandlers
};
