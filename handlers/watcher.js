import { FileWatcher } from '../watcher/FileWatcher.js';
import { TriggerManager } from '../watcher/TriggerManager.js';

// Singleton-ish storage for the active watcher
let activeWatcher = null;
let activeTriggerManager = null;

export const watcherHandlers = {
  start_watcher: async (args) => {
    if (activeWatcher) {
      return { content: [{ type: "text", text: "Watcher is already running." }] };
    }

    const projectPath = args.projectPath || process.cwd();
    activeWatcher = new FileWatcher(projectPath);
    activeTriggerManager = new TriggerManager(activeWatcher);
    
    const started = activeWatcher.start();
    
    if (started) {
      return { 
        content: [{ 
          type: "text", 
          text: `👀 **Proactive Watcher Started**\n\nMonitoring: ${projectPath}\nignored: node_modules, .git\n\nI am now watching for file changes in the background!` 
        }] 
      };
    } else {
      activeWatcher = null;
      return { content: [{ type: "text", text: "Failed to start watcher." }], isError: true };
    }
  },

  stop_watcher: async () => {
    if (activeWatcher) {
      activeWatcher.stop();
      activeWatcher = null;
      activeTriggerManager = null;
      return { content: [{ type: "text", text: "🛑 Watcher stopped." }] };
    }
    return { content: [{ type: "text", text: "No watcher is currently running." }] };
  },
  
  watcher_status: async () => {
    return { 
      content: [{ 
        type: "text", 
        text: activeWatcher 
          ? `✅ Watcher is ACTIVE on: ${activeWatcher.projectPath}`
          : "❌ Watcher is INACTIVE" 
      }] 
    };
  }
};
