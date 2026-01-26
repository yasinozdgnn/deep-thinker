import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { generateUUID } from '../config.js';

export class SandboxManager {
  constructor(config = {}) {
    this.config = {
      timeout: 5000,
      maxBuffer: 1024 * 1024, // 1MB
      tempDir: path.join(os.tmpdir(), 'deep-thinker-sandbox'),
      ...config
    };
  }

  async initialize() {
    try {
      await fs.mkdir(this.config.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to init sandbox dir:', error);
    }
  }

  async execute(code, language = 'javascript', dependencies = []) {
    await this.initialize();
    
    const runId = generateUUID();
    const workDir = path.join(this.config.tempDir, runId);
    
    try {
      await fs.mkdir(workDir, { recursive: true });
      
      const { fileName, command, args } = this.getLanguageConfig(language);
      const filePath = path.join(workDir, fileName);
      
      await fs.writeFile(filePath, code);

      // Handle dependencies (Node.js only for MVP)
      if (dependencies.length > 0 && language === 'javascript') {
        // In a real scenario, we'd npm install here, but that's slow.
        // For MVP, we'll assume global or project-local deps, or just mock them.
        // Or create a package.json
      }

      return await this.runProcess(command, [...args, filePath], workDir);
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: '',
        stderr: error.message,
        executionTime: 0
      };
    } finally {
      // Cleanup
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch {}
    }
  }

  getLanguageConfig(language) {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
      case 'node':
        return { fileName: 'script.js', command: 'node', args: [] };
      case 'python':
      case 'py':
        return { fileName: 'script.py', command: 'python', args: [] };
      case 'typescript':
      case 'ts':
        // Requires ts-node or compilation. Using node loader for now if supported.
        return { fileName: 'script.ts', command: 'npx', args: ['ts-node'] };
      case 'bash':
      case 'sh':
        return { fileName: 'script.sh', command: 'bash', args: [] };
      case 'php':
        return { fileName: 'script.php', command: 'php', args: [] };
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  runProcess(command, args, cwd) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(command, args, {
        cwd,
        env: { ...process.env, PATH: process.env.PATH }, // Inherit basic env
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Timeout logic
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, this.config.timeout);

      child.stdout.on('data', (data) => {
        if (stdout.length < this.config.maxBuffer) {
          stdout += data.toString();
        }
      });

      child.stderr.on('data', (data) => {
        if (stderr.length < this.config.maxBuffer) {
          stderr += data.toString();
        }
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;
        
        if (timedOut) {
          resolve({
            success: false,
            error: 'Execution timed out',
            stdout,
            stderr: stderr + '\n[Error: Execution timed out]',
            exitCode: null,
            executionTime
          });
        } else {
          resolve({
            success: code === 0,
            stdout,
            stderr,
            exitCode: code,
            executionTime
          });
        }
      });
      
      child.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: err.message,
          stdout,
          stderr: stderr + `\n[spawn error]: ${err.message}`,
          exitCode: null,
          executionTime: Date.now() - startTime
        });
      });
    });
  }
}
