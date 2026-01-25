import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { MEMORY_CONFIG, generateProjectId } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_DIR = path.join(__dirname, '..', '.memory');
const DB_PATH = path.join(MEMORY_DIR, 'agent.db');

let db = null;

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function getDatabase() {
  if (db) return db;
  
  ensureMemoryDir();
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      name TEXT,
      tech_stack TEXT,
      file_structure TEXT,
      code_style TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      context TEXT,
      input_summary TEXT,
      output_summary TEXT,
      success INTEGER DEFAULT 1,
      confidence REAL DEFAULT 1.0,
      execution_time INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    
    CREATE TABLE IF NOT EXISTS tool_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      total_calls INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      avg_execution_time REAL DEFAULT 0,
      last_used TEXT,
      UNIQUE(project_id, tool_name),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    
    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      error_type TEXT,
      error_message TEXT,
      context TEXT,
      resolution TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    
    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      step_index INTEGER,
      state TEXT NOT NULL,
      file_snapshots TEXT,
      hash TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_patterns_project ON patterns(project_id);
    CREATE INDEX IF NOT EXISTS idx_patterns_tool ON patterns(tool_name);
    CREATE INDEX IF NOT EXISTS idx_tool_stats_project ON tool_stats(project_id);
    CREATE INDEX IF NOT EXISTS idx_errors_project ON errors(project_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_plan ON checkpoints(plan_id);
  `);
  
  return db;
}

export class ProjectMemory {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectId = generateProjectId(projectPath);
    this.db = getDatabase();
  }
  
  async register(info = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, path, name, tech_stack, file_structure, code_style)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tech_stack = excluded.tech_stack,
        file_structure = excluded.file_structure,
        code_style = excluded.code_style,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    stmt.run(
      this.projectId,
      this.projectPath,
      info.name || path.basename(this.projectPath),
      JSON.stringify(info.techStack || []),
      JSON.stringify(info.fileStructure || {}),
      JSON.stringify(info.codeStyle || {})
    );
    
    return this.projectId;
  }
  
  async getInfo() {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(this.projectId);
    
    if (!row) return null;
    
    return {
      id: row.id,
      path: row.path,
      name: row.name,
      techStack: JSON.parse(row.tech_stack || '[]'),
      fileStructure: JSON.parse(row.file_structure || '{}'),
      codeStyle: JSON.parse(row.code_style || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  async updateTechStack(techStack) {
    const stmt = this.db.prepare(`
      UPDATE projects SET tech_stack = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(JSON.stringify(techStack), this.projectId);
  }
  
  async updateCodeStyle(codeStyle) {
    const stmt = this.db.prepare(`
      UPDATE projects SET code_style = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(JSON.stringify(codeStyle), this.projectId);
  }
}

export class LearningMemory {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectId = generateProjectId(projectPath);
    this.db = getDatabase();
  }
  
  async recordToolUsage(toolName, context, success, executionTime, inputSummary = '', outputSummary = '') {
    const patternStmt = this.db.prepare(`
      INSERT INTO patterns (project_id, tool_name, context, input_summary, output_summary, success, execution_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    patternStmt.run(
      this.projectId,
      toolName,
      JSON.stringify(context),
      inputSummary,
      outputSummary,
      success ? 1 : 0,
      executionTime
    );
    
    const statsStmt = this.db.prepare(`
      INSERT INTO tool_stats (project_id, tool_name, total_calls, success_count, failure_count, avg_execution_time, last_used)
      VALUES (?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(project_id, tool_name) DO UPDATE SET
        total_calls = total_calls + 1,
        success_count = success_count + ?,
        failure_count = failure_count + ?,
        avg_execution_time = (avg_execution_time * total_calls + ?) / (total_calls + 1),
        last_used = CURRENT_TIMESTAMP
    `);
    statsStmt.run(
      this.projectId,
      toolName,
      success ? 1 : 0,
      success ? 0 : 1,
      executionTime,
      success ? 1 : 0,
      success ? 0 : 1,
      executionTime
    );
    
    await this.pruneOldPatterns();
  }
  
  async recordError(toolName, errorType, errorMessage, context, resolution = null) {
    const stmt = this.db.prepare(`
      INSERT INTO errors (project_id, tool_name, error_type, error_message, context, resolution)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(this.projectId, toolName, errorType, errorMessage, JSON.stringify(context), resolution);
  }
  
  async getToolStats(toolName = null) {
    if (toolName) {
      const stmt = this.db.prepare('SELECT * FROM tool_stats WHERE project_id = ? AND tool_name = ?');
      return stmt.get(this.projectId, toolName);
    }
    
    const stmt = this.db.prepare('SELECT * FROM tool_stats WHERE project_id = ? ORDER BY total_calls DESC');
    return stmt.all(this.projectId);
  }
  
  async getSuccessRate(toolName) {
    const stats = await this.getToolStats(toolName);
    if (!stats || stats.total_calls === 0) return 1.0;
    return stats.success_count / stats.total_calls;
  }
  
  async getSimilarPatterns(toolName, context, limit = 5) {
    const stmt = this.db.prepare(`
      SELECT * FROM patterns 
      WHERE project_id = ? AND tool_name = ? AND success = 1
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(this.projectId, toolName, limit);
  }
  
  async getRecentErrors(toolName = null, limit = 10) {
    if (toolName) {
      const stmt = this.db.prepare(`
        SELECT * FROM errors WHERE project_id = ? AND tool_name = ?
        ORDER BY created_at DESC LIMIT ?
      `);
      return stmt.all(this.projectId, toolName, limit);
    }
    
    const stmt = this.db.prepare(`
      SELECT * FROM errors WHERE project_id = ?
      ORDER BY created_at DESC LIMIT ?
    `);
    return stmt.all(this.projectId, limit);
  }
  
  async pruneOldPatterns() {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM patterns WHERE project_id = ?');
    const { count } = countStmt.get(this.projectId);
    
    if (count > MEMORY_CONFIG.maxPatternCount * MEMORY_CONFIG.pruneThreshold) {
      const deleteStmt = this.db.prepare(`
        DELETE FROM patterns WHERE project_id = ? AND id IN (
          SELECT id FROM patterns WHERE project_id = ?
          ORDER BY created_at ASC
          LIMIT ?
        )
      `);
      const toDelete = Math.floor(count - MEMORY_CONFIG.maxPatternCount * 0.5);
      deleteStmt.run(this.projectId, this.projectId, toDelete);
    }
  }
  
  async getBestToolForTask(taskType) {
    const stmt = this.db.prepare(`
      SELECT tool_name, 
             SUM(success) as successes,
             COUNT(*) as total,
             AVG(execution_time) as avg_time
      FROM patterns 
      WHERE project_id = ? AND context LIKE ?
      GROUP BY tool_name
      ORDER BY (CAST(successes AS REAL) / total) DESC, avg_time ASC
      LIMIT 1
    `);
    return stmt.get(this.projectId, `%${taskType}%`);
  }
}

export class CheckpointManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectId = generateProjectId(projectPath);
    this.db = getDatabase();
  }
  
  async save(planId, stepIndex, state, fileSnapshots = {}) {
    const id = `cp_${Date.now()}_${stepIndex}`;
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(state))
      .digest('hex');
    
    const stmt = this.db.prepare(`
      INSERT INTO checkpoints (id, project_id, plan_id, step_index, state, file_snapshots, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, this.projectId, planId, stepIndex, JSON.stringify(state), JSON.stringify(fileSnapshots), hash);
    
    await this.pruneOldCheckpoints(planId);
    
    return id;
  }
  
  async load(checkpointId) {
    const stmt = this.db.prepare('SELECT * FROM checkpoints WHERE id = ? AND project_id = ?');
    const row = stmt.get(checkpointId, this.projectId);
    
    if (!row) return null;
    
    const state = JSON.parse(row.state);
    const currentHash = crypto.createHash('sha256')
      .update(JSON.stringify(state))
      .digest('hex');
    
    return {
      id: row.id,
      planId: row.plan_id,
      stepIndex: row.step_index,
      state,
      fileSnapshots: JSON.parse(row.file_snapshots || '{}'),
      hash: row.hash,
      isValid: currentHash === row.hash,
      createdAt: row.created_at
    };
  }
  
  async getLatest(planId) {
    const stmt = this.db.prepare(`
      SELECT * FROM checkpoints 
      WHERE project_id = ? AND plan_id = ?
      ORDER BY step_index DESC
      LIMIT 1
    `);
    const row = stmt.get(this.projectId, planId);
    
    if (!row) return null;
    return this.load(row.id);
  }
  
  async pruneOldCheckpoints(planId) {
    const stmt = this.db.prepare(`
      DELETE FROM checkpoints WHERE project_id = ? AND plan_id = ? AND id NOT IN (
        SELECT id FROM checkpoints WHERE project_id = ? AND plan_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      )
    `);
    stmt.run(this.projectId, planId, this.projectId, planId, MEMORY_CONFIG.maxCheckpoints || 10);
  }
  
  async deleteAll(planId) {
    const stmt = this.db.prepare('DELETE FROM checkpoints WHERE project_id = ? AND plan_id = ?');
    stmt.run(this.projectId, planId);
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
