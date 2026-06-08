import fs from 'fs/promises';
import path from 'path';
import { callAI } from '../helpers/index.js';
import { SimpleVectorStore } from './SimpleVectorStore.js';

export class CodeIndexer {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.store = new SimpleVectorStore(path.join(projectPath, '.deep-thinker-memory.json'));
    this.ignoredDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.deep-thinker-memory.json'];
    this.extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.md', '.json'];
  }

  async index() {
    await this.store.load();
    const files = await this.scanDir(this.projectPath);
    let updatedCount = 0;

    console.log(`[Indexer] Found ${files.length} candidate files.`);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const hash = this.store.calculateHash(content);
        const relativePath = path.relative(this.projectPath, file);
        
        const existing = this.store.get(relativePath);

        // Skip if unchanged
        if (existing && existing.content_hash === hash) {
            continue;
        }

        console.log(`[Indexer] Indexing: ${relativePath}...`);
        
        // Generate summary using AI
        const analysis = await this.analyzeFile(relativePath, content);
        
        await this.store.upsert({
          id: relativePath,
          content_hash: hash,
          summary: analysis.summary,
          tags: analysis.tags
        });
        
        updatedCount++;
      } catch (err) {
        console.error(`[Indexer] Failed to index ${file}: ${err.message}`);
      }
    }

    return { total: files.length, updated: updatedCount };
  }

  async scanDir(dir) {
    let results = [];
    const list = await fs.readdir(dir);
    
    for (const file of list) {
      if (this.ignoredDirs.includes(file)) continue;
      const fullPath = path.join(dir, file);
      const stat = await fs.stat(fullPath);
      
      if (stat && stat.isDirectory()) {
        results = results.concat(await this.scanDir(fullPath));
      } else {
        if (this.extensions.includes(path.extname(file))) {
          results.push(fullPath);
        }
      }
    }
    return results;
  }

  async analyzeFile(filePath, content) {
    // Truncate large files for tokenizer safety
    const truncatedContent = content.slice(0, 10000); 
    
    const prompt = `Analyze this code file.
File: ${filePath}
Content:
\`\`\`
${truncatedContent}
\`\`\`

Return a JSON object with:
1. "summary": A concise single-sentence summary of what this file does.
2. "tags": An array of 5-10 technical keywords (e.g., "auth", "middleware", "utils").

JSON:`;

    const response = await callAI(prompt);
    
    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {}

    return { summary: "Could not analyze", tags: [] };
  }
}
