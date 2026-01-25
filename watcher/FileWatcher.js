import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export class FileWatcher extends EventEmitter {
  constructor(projectPath, options = {}) {
    super();
    this.projectPath = projectPath;
    this.options = { 
      ignored: ['node_modules', '.git', 'dist', 'build', '.deep-thinker-memory.json'],
      debounceMs: 500,
      ...options 
    };
    this.watchers = [];
    this.changedFiles = new Set();
    this.debounceTimer = null;
  }

  start() {
    try {
      this.watchRecursive(this.projectPath);
      console.log(`[Watcher] Started watching ${this.projectPath}`);
      return true;
    } catch (err) {
      console.error(`[Watcher] Failed to start: ${err.message}`);
      return false;
    }
  }

  stop() {
    this.watchers.forEach(w => w.close());
    this.watchers = [];
    console.log('[Watcher] Stopped.');
  }

  watchRecursive(dir) {
    const watcher = fs.watch(dir, { recursive: false }, (eventType, filename) => {
      if (!filename) return;
      if (this.options.ignored.some(i => filename.includes(i))) return;

      const fullPath = path.join(dir, filename);
      this.handleEvent(eventType, fullPath);
    });

    this.watchers.push(watcher);

    // Manually recurse for subdirectories because recursive:true is platform dependent/unstable
    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory() && !this.options.ignored.includes(file.name)) {
          this.watchRecursive(path.join(dir, file.name));
        }
      }
    } catch (e) {
      // Directory might be deleted or locked
    }
  }

  handleEvent(eventType, filePath) {
    this.changedFiles.add(filePath);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.emit('change', Array.from(this.changedFiles));
      this.changedFiles.clear();
    }, this.options.debounceMs);
  }
}
