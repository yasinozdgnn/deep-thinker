import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MEMORY_CONFIG, generateProjectId } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_DIR = path.join(__dirname, '..', '.memory');

// ─── Dynamic better-sqlite3 loader ────────────────────────────
let Database = null;
let sqliteError = null;
try {
  const mod = await import('better-sqlite3');
  Database = mod.default;
} catch (e) {
  sqliteError = e.message;
  if (!process.env.SILENT_MEMORY_WARN) {
    console.error(`[Memory] better-sqlite3 yüklenemedi, JSON depolama kullanılacak. (${e.message})`);
  }
}

// ─── JSON File Store ──────────────────────────────────────────

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

const JSON_STORE_PATH = path.join(MEMORY_DIR, 'agent-store.json');

function readStore() {
  ensureMemoryDir();
  try {
    const raw = fs.readFileSync(JSON_STORE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      projects: {},
      patterns: [],
      toolStats: {},
      errors: [],
      checkpoints: [],
      plans: {}
    };
  }
}

function writeStore(store) {
  ensureMemoryDir();
  fs.writeFileSync(JSON_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

let nextId = 1;
function uid() { return nextId++; }

// ─── SQLite Backend ───────────────────────────────────────────

let db = null;

function getSqliteDb() {
  if (db) return db;
  if (!Database) return null;
  
  ensureMemoryDir();
  const dbPath = path.join(MEMORY_DIR, 'agent.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, path TEXT NOT NULL, name TEXT,
      tech_stack TEXT, file_structure TEXT, code_style TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL, tool_name TEXT NOT NULL,
      context TEXT, input_summary TEXT, output_summary TEXT,
      success INTEGER DEFAULT 1, confidence REAL DEFAULT 1.0,
      execution_time INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS tool_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL, tool_name TEXT NOT NULL,
      total_calls INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0, avg_execution_time REAL DEFAULT 0,
      last_used TEXT, UNIQUE(project_id, tool_name),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL, tool_name TEXT NOT NULL,
      error_type TEXT, error_message TEXT, context TEXT,
      resolution TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      plan_id TEXT NOT NULL, step_index INTEGER,
      state TEXT NOT NULL, file_snapshots TEXT,
      hash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      goal TEXT NOT NULL, status TEXT DEFAULT 'pending',
      current_step INTEGER DEFAULT 0, total_steps INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_patterns_project ON patterns(project_id);
    CREATE INDEX IF NOT EXISTS idx_patterns_tool ON patterns(tool_name);
    CREATE INDEX IF NOT EXISTS idx_tool_stats_project ON tool_stats(project_id);
    CREATE INDEX IF NOT EXISTS idx_errors_project ON errors(project_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_plan ON checkpoints(plan_id);
    CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_id);
  `);
  
  return db;
}

function usingSqlite() {
  return Database !== null && getSqliteDb() !== null;
}

// ─── ProjectMemory ────────────────────────────────────────────

export class ProjectMemory {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectId = generateProjectId(projectPath);
  }

  async register(info = {}) {
    if (usingSqlite()) {
      const s = getSqliteDb().prepare(`
        INSERT INTO projects (id, path, name, tech_stack, file_structure, code_style)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          tech_stack = excluded.tech_stack,
          file_structure = excluded.file_structure,
          code_style = excluded.code_style,
          updated_at = CURRENT_TIMESTAMP
      `);
      s.run(this.projectId, this.projectPath, info.name || path.basename(this.projectPath),
        JSON.stringify(info.techStack || []), JSON.stringify(info.fileStructure || {}),
        JSON.stringify(info.codeStyle || {}));
    } else {
      const store = readStore();
      store.projects[this.projectId] = {
        id: this.projectId,
        path: this.projectPath,
        name: info.name || path.basename(this.projectPath),
        techStack: info.techStack || [],
        fileStructure: info.fileStructure || {},
        codeStyle: info.codeStyle || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      writeStore(store);
    }
    return this.projectId;
  }

  async getInfo() {
    if (usingSqlite()) {
      const row = getSqliteDb().prepare('SELECT * FROM projects WHERE id = ?').get(this.projectId);
      if (!row) return null;
      return { id: row.id, path: row.path, name: row.name,
        techStack: JSON.parse(row.tech_stack || '[]'),
        fileStructure: JSON.parse(row.file_structure || '{}'),
        codeStyle: JSON.parse(row.code_style || '{}'),
        createdAt: row.created_at, updatedAt: row.updated_at };
    } else {
      const store = readStore();
      const p = store.projects[this.projectId];
      return p || null;
    }
  }

  async updateTechStack(techStack) {
    if (usingSqlite()) {
      getSqliteDb().prepare('UPDATE projects SET tech_stack = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(techStack), this.projectId);
    } else {
      const store = readStore();
      if (store.projects[this.projectId]) {
        store.projects[this.projectId].techStack = techStack;
        store.projects[this.projectId].updatedAt = new Date().toISOString();
        writeStore(store);
      }
    }
  }

  async updateCodeStyle(codeStyle) {
    if (usingSqlite()) {
      getSqliteDb().prepare('UPDATE projects SET code_style = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(codeStyle), this.projectId);
    } else {
      const store = readStore();
      if (store.projects[this.projectId]) {
        store.projects[this.projectId].codeStyle = codeStyle;
        store.projects[this.projectId].updatedAt = new Date().toISOString();
        writeStore(store);
      }
    }
  }

  async recordPlan(plan) {
    if (usingSqlite()) {
      getSqliteDb().prepare(`
        INSERT INTO plans (id, project_id, goal, status, current_step, total_steps)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status=excluded.status, current_step=excluded.current_step, total_steps=excluded.total_steps, updated_at=CURRENT_TIMESTAMP
      `).run(plan.id, this.projectId, plan.goal, plan.status, plan.currentStepIndex || 0, plan.steps?.length || 0);
    } else {
      const store = readStore();
      store.plans[plan.id] = { id: plan.id, projectId: this.projectId, goal: plan.goal, status: plan.status,
        currentStep: plan.currentStepIndex || 0, totalSteps: plan.steps?.length || 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      writeStore(store);
    }
  }

  async updatePlanProgress(planId, status, currentStep) {
    if (usingSqlite()) {
      getSqliteDb().prepare('UPDATE plans SET status=?, current_step=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?')
        .run(status, currentStep, planId, this.projectId);
    } else {
      const store = readStore();
      if (store.plans[planId]) {
        store.plans[planId].status = status;
        store.plans[planId].currentStep = currentStep;
        store.plans[planId].updatedAt = new Date().toISOString();
        writeStore(store);
      }
    }
  }
}

// ─── LearningMemory ───────────────────────────────────────────

export class LearningMemory {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectId = generateProjectId(projectPath);
  }

  async recordToolUsage(toolName, context, success, executionTime, inputSummary = '', outputSummary = '') {
    if (usingSqlite()) {
      const s = getSqliteDb().prepare(`INSERT INTO patterns (project_id, tool_name, context, input_summary, output_summary, success, execution_time) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      s.run(this.projectId, toolName, JSON.stringify(context), inputSummary, outputSummary, success ? 1 : 0, executionTime);
      getSqliteDb().prepare(`
        INSERT INTO tool_stats (project_id, tool_name, total_calls, success_count, failure_count, avg_execution_time, last_used)
        VALUES (?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id, tool_name) DO UPDATE SET
          total_calls = total_calls + 1, success_count = success_count + ?,
          failure_count = failure_count + ?, avg_execution_time = (avg_execution_time * (total_calls - 1) + ?) / total_calls,
          last_used = CURRENT_TIMESTAMP
      `).run(this.projectId, toolName, success ? 1 : 0, success ? 0 : 1, executionTime, success ? 1 : 0, success ? 0 : 1, executionTime);
    } else {
      const store = readStore();
      store.patterns.push({
        id: uid(), projectId: this.projectId, toolName, context: JSON.stringify(context),
        inputSummary, outputSummary, success, executionTime,
        createdAt: new Date().toISOString()
      });
      const key = `${this.projectId}:${toolName}`;
      if (!store.toolStats[key]) {
        store.toolStats[key] = { projectId: this.projectId, toolName, totalCalls: 0, successCount: 0, failureCount: 0, avgTime: 0, lastUsed: '' };
      }
      const t = store.toolStats[key];
      t.totalCalls++;
      if (success) t.successCount++; else t.failureCount++;
      t.avgTime = (t.avgTime * (t.totalCalls - 1) + executionTime) / t.totalCalls;
      t.lastUsed = new Date().toISOString();
      writeStore(store);
    }
    await this.pruneOldPatterns();
  }

  async recordError(toolName, errorType, errorMessage, context, resolution = null) {
    if (usingSqlite()) {
      getSqliteDb().prepare('INSERT INTO errors (project_id, tool_name, error_type, error_message, context, resolution) VALUES (?, ?, ?, ?, ?, ?)')
        .run(this.projectId, toolName, errorType, errorMessage, JSON.stringify(context), resolution);
    } else {
      const store = readStore();
      store.errors.push({ id: uid(), projectId: this.projectId, toolName, errorType, errorMessage,
        context: JSON.stringify(context), resolution, createdAt: new Date().toISOString() });
      writeStore(store);
    }
  }

  async getToolStats(toolName = null) {
    if (usingSqlite()) {
      if (toolName) return getSqliteDb().prepare('SELECT * FROM tool_stats WHERE project_id = ? AND tool_name = ?').get(this.projectId, toolName);
      return getSqliteDb().prepare('SELECT * FROM tool_stats WHERE project_id = ? ORDER BY total_calls DESC').all(this.projectId);
    } else {
      const store = readStore();
      const entries = Object.values(store.toolStats).filter(t => t.projectId === this.projectId);
      if (toolName) return entries.find(t => t.toolName === toolName) || null;
      return entries.sort((a, b) => b.totalCalls - a.totalCalls);
    }
  }

  async getSuccessRate(toolName) {
    const stats = await this.getToolStats(toolName);
    if (!stats || stats.totalCalls === 0) return 1.0;
    return stats.successCount / stats.totalCalls;
  }

  async getSimilarPatterns(toolName, context, limit = 5) {
    if (usingSqlite()) {
      return getSqliteDb().prepare('SELECT * FROM patterns WHERE project_id = ? AND tool_name = ? AND success = 1 ORDER BY created_at DESC LIMIT ?')
        .all(this.projectId, toolName, limit);
    } else {
      const store = readStore();
      return store.patterns.filter(p => p.projectId === this.projectId && p.toolName === toolName && p.success)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }
  }

  async getRecentErrors(toolName = null, limit = 10) {
    if (usingSqlite()) {
      if (toolName) return getSqliteDb().prepare('SELECT * FROM errors WHERE project_id = ? AND tool_name = ? ORDER BY created_at DESC LIMIT ?').all(this.projectId, toolName, limit);
      return getSqliteDb().prepare('SELECT * FROM errors WHERE project_id = ? ORDER BY created_at DESC LIMIT ?').all(this.projectId, limit);
    } else {
      const store = readStore();
      let errs = store.errors.filter(e => e.projectId === this.projectId);
      if (toolName) errs = errs.filter(e => e.toolName === toolName);
      return errs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }
  }

  async pruneOldPatterns() {
    if (usingSqlite()) {
      const { count } = getSqliteDb().prepare('SELECT COUNT(*) as count FROM patterns WHERE project_id = ?').get(this.projectId);
      if (count > MEMORY_CONFIG.maxPatternCount * MEMORY_CONFIG.pruneThreshold) {
        const toDelete = Math.floor(count - MEMORY_CONFIG.maxPatternCount * 0.5);
        getSqliteDb().prepare(`DELETE FROM patterns WHERE project_id = ? AND id IN (SELECT id FROM patterns WHERE project_id = ? ORDER BY created_at ASC LIMIT ?)`).run(this.projectId, this.projectId, toDelete);
      }
    } else {
      const store = readStore();
      const projectPatterns = store.patterns.filter(p => p.projectId === this.projectId);
      if (projectPatterns.length > MEMORY_CONFIG.maxPatternCount * MEMORY_CONFIG.pruneThreshold) {
        const toDelete = Math.floor(projectPatterns.length - MEMORY_CONFIG.maxPatternCount * 0.5);
        const idsToRemove = projectPatterns.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, toDelete).map(p => p.id);
        store.patterns = store.patterns.filter(p => !idsToRemove.includes(p.id));
        writeStore(store);
      }
    }
  }

  async getBestToolForTask(taskType) {
    if (usingSqlite()) {
      return getSqliteDb().prepare(`SELECT tool_name, SUM(success) as successes, COUNT(*) as total, AVG(execution_time) as avg_time FROM patterns WHERE project_id = ? AND context LIKE ? GROUP BY tool_name ORDER BY (CAST(successes AS REAL) / total) DESC, avg_time ASC LIMIT 1`)
        .get(this.projectId, `%${taskType}%`);
    } else {
      const store = readStore();
      const matches = store.patterns.filter(p => p.projectId === this.projectId && p.context && p.context.includes(taskType));
      const grouped = {};
      for (const m of matches) {
        if (!grouped[m.toolName]) grouped[m.toolName] = { successes: 0, total: 0, avgTime: 0 };
        grouped[m.toolName].total++;
        grouped[m.toolName].avgTime += m.executionTime || 0;
        if (m.success) grouped[m.toolName].successes++;
      }
      const entries = Object.entries(grouped).map(([name, data]) => ({ ...data, avgTime: data.avgTime / data.total }));
      entries.sort((a, b) => (b.successes / b.total) - (a.successes / a.total) || a.avgTime - b.avgTime);
      return entries[0] || null;
    }
  }
}

// ─── CheckpointManager ────────────────────────────────────────

export class CheckpointManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectId = generateProjectId(projectPath);
  }

  async save(planId, stepIndex, state, fileSnapshots = {}) {
    const id = `cp_${Date.now()}_${stepIndex}`;
    const hash = crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');

    if (usingSqlite()) {
      getSqliteDb().prepare('INSERT INTO checkpoints (id, project_id, plan_id, step_index, state, file_snapshots, hash) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, this.projectId, planId, stepIndex, JSON.stringify(state), JSON.stringify(fileSnapshots), hash);
    } else {
      const store = readStore();
      store.checkpoints.push({ id, projectId: this.projectId, planId, stepIndex, state: JSON.stringify(state),
        fileSnapshots: JSON.stringify(fileSnapshots), hash, createdAt: new Date().toISOString() });
      writeStore(store);
    }
    await this.pruneOldCheckpoints(planId);
    return id;
  }

  async load(checkpointId) {
    let row;
    if (usingSqlite()) {
      row = getSqliteDb().prepare('SELECT * FROM checkpoints WHERE id = ? AND project_id = ?').get(checkpointId, this.projectId);
    } else {
      const store = readStore();
      row = store.checkpoints.find(c => c.id === checkpointId && c.projectId === this.projectId);
    }
    if (!row) return null;
    const state = JSON.parse(row.state);
    const currentHash = crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');
    return { id: row.id, planId: row.plan_id || row.planId, stepIndex: row.step_index || row.stepIndex,
      state, fileSnapshots: JSON.parse(row.file_snapshots || '{}'), hash: row.hash,
      isValid: currentHash === row.hash, createdAt: row.created_at || row.createdAt };
  }

  async getLatest(planId) {
    let row;
    if (usingSqlite()) {
      row = getSqliteDb().prepare('SELECT * FROM checkpoints WHERE project_id = ? AND plan_id = ? ORDER BY step_index DESC LIMIT 1').get(this.projectId, planId);
    } else {
      const store = readStore();
      row = store.checkpoints.filter(c => c.projectId === this.projectId && (c.planId || c.plan_id) === planId)
        .sort((a, b) => (b.stepIndex || b.step_index) - (a.stepIndex || a.step_index))[0];
    }
    if (!row) return null;
    return this.load(row.id);
  }

  async pruneOldCheckpoints(planId) {
    if (usingSqlite()) {
      getSqliteDb().prepare(`DELETE FROM checkpoints WHERE project_id = ? AND plan_id = ? AND id NOT IN (SELECT id FROM checkpoints WHERE project_id = ? AND plan_id = ? ORDER BY created_at DESC LIMIT ?)`)
        .run(this.projectId, planId, this.projectId, planId, MEMORY_CONFIG.maxCheckpoints || 10);
    } else {
      const store = readStore();
      const relevant = store.checkpoints.filter(c => c.projectId === this.projectId && (c.planId || c.plan_id) === planId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (relevant.length > (MEMORY_CONFIG.maxCheckpoints || 10)) {
        const keepIds = relevant.slice(0, MEMORY_CONFIG.maxCheckpoints || 10).map(c => c.id);
        store.checkpoints = store.checkpoints.filter(c => !(c.projectId === this.projectId && (c.planId || c.plan_id) === planId && !keepIds.includes(c.id)));
        writeStore(store);
      }
    }
  }

  async deleteAll(planId) {
    if (usingSqlite()) {
      getSqliteDb().prepare('DELETE FROM checkpoints WHERE project_id = ? AND plan_id = ?').run(this.projectId, planId);
    } else {
      const store = readStore();
      store.checkpoints = store.checkpoints.filter(c => !(c.projectId === this.projectId && (c.planId || c.plan_id) === planId));
      writeStore(store);
    }
  }
}

// ─── Cleanup ──────────────────────────────────────────────────

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
