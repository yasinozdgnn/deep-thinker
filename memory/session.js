import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MEMORY_CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_DIR = path.join(__dirname, '..', '.memory', 'sessions');

function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

export class SessionMemory {
  constructor(sessionId = null) {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.data = {
      id: this.sessionId,
      startedAt: new Date().toISOString(),
      currentTask: null,
      activePlan: null,
      history: [],
      variables: {},
      context: {}
    };
    this.filePath = null;
    ensureSessionDir();
  }
  
  setCurrentTask(task) {
    this.data.currentTask = {
      ...task,
      startedAt: new Date().toISOString()
    };
  }
  
  clearCurrentTask() {
    if (this.data.currentTask) {
      this.addToHistory({
        type: 'task_completed',
        task: this.data.currentTask,
        completedAt: new Date().toISOString()
      });
    }
    this.data.currentTask = null;
  }
  
  setActivePlan(plan) {
    this.data.activePlan = plan;
  }
  
  getActivePlan() {
    return this.data.activePlan;
  }
  
  clearActivePlan() {
    this.data.activePlan = null;
  }
  
  addToHistory(entry) {
    this.data.history.push({
      ...entry,
      timestamp: new Date().toISOString()
    });
    
    if (this.data.history.length > MEMORY_CONFIG.maxSessionHistory) {
      this.data.history = this.data.history.slice(-MEMORY_CONFIG.maxSessionHistory);
    }
  }
  
  getRecentHistory(count = 10) {
    return this.data.history.slice(-count);
  }
  
  setVariable(key, value) {
    this.data.variables[key] = value;
  }
  
  getVariable(key, defaultValue = null) {
    return this.data.variables[key] ?? defaultValue;
  }
  
  deleteVariable(key) {
    delete this.data.variables[key];
  }
  
  setContext(key, value) {
    this.data.context[key] = value;
  }
  
  getContext(key = null) {
    if (key === null) return this.data.context;
    return this.data.context[key];
  }
  
  clearContext() {
    this.data.context = {};
  }
  
  save() {
    ensureSessionDir();
    this.filePath = path.join(SESSION_DIR, `${this.sessionId}.json`);
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    return this.filePath;
  }
  
  static load(sessionId) {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const session = new SessionMemory(sessionId);
      session.data = data;
      session.filePath = filePath;
      return session;
    } catch {
      return null;
    }
  }
  
  static getRecent(limit = 5) {
    ensureSessionDir();
    
    try {
      const files = fs.readdirSync(SESSION_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(SESSION_DIR, f),
          mtime: fs.statSync(path.join(SESSION_DIR, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit);
      
      return files.map(f => {
        try {
          return JSON.parse(fs.readFileSync(f.path, 'utf-8'));
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }
  
  static cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) {
    ensureSessionDir();
    
    const now = Date.now();
    let deleted = 0;
    
    try {
      const files = fs.readdirSync(SESSION_DIR);
      
      for (const file of files) {
        const filePath = path.join(SESSION_DIR, file);
        const stat = fs.statSync(filePath);
        
        if (now - stat.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
    } catch {}
    
    return deleted;
  }
  
  destroy() {
    if (this.filePath && fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
    this.data = null;
  }
  
  toJSON() {
    return this.data;
  }
}
