import { CodeIndexer } from '../memory/CodeIndexer.js';
import { SimpleVectorStore } from '../memory/SimpleVectorStore.js';
import { callGLM } from '../helpers/index.js';
import path from 'path';

export const memoryHandlers = {
  index_codebase: async (args) => {
    const projectPath = args.projectPath || process.cwd();
    const indexer = new CodeIndexer(projectPath);
    const result = await indexer.index();
    
    return {
      content: [{
        type: "text",
        text: `🧠 **Semantic Memory Update**\n\n` +
              `Scanned: ${result.total} files\n` +
              `Updated/Indexed: ${result.updated} files\n` +
              `Memory File: .deep-thinker-memory.json`
      }]
    };
  },

  semantic_search: async (args) => {
    const projectPath = args.projectPath || process.cwd();
    const store = new SimpleVectorStore(path.join(projectPath, '.deep-thinker-memory.json'));
    await store.load();
    const allDocs = store.getAll();

    if (allDocs.length === 0) {
      return { content: [{ type: "text", text: "⚠️ Memory is empty. Please run 'index_codebase' first." }] };
    }

    // Hybrid Search approach (Keyword + LLM Re-ranking)
    
    // 1. Keyword Filtering (Client-side simple filter)
    const keywords = args.query.toLowerCase().split(' ');
    const candidates = allDocs.filter(doc => {
       const text = (doc.id + ' ' + (doc.tags || []).join(' ')).toLowerCase();
       return keywords.some(k => text.includes(k));
    });

    // If too many results or too few, fallback to taking the first 50 to rerank
    const pool = candidates.length > 0 ? candidates : allDocs.slice(0, 50);

    // 2. LLM Re-ranking (The "Semantic" part)
    const rankingPrompt = `Rank the following files based on their relevance to the query: "${args.query}"
    
Files:
${pool.map((d, i) => `${i}. [${d.id}] Tags: ${d.tags.join(', ')} Summary: ${d.summary}`).join('\n')}

Return the IDs of the top 3 most relevant files, explained briefly.`;

    const rankingResult = await callGLM(rankingPrompt);

    return {
      content: [{
        type: "text",
        text: `🔍 **Semantic Search Results**\n` +
              `Query: "${args.query}"\n\n` +
              `${rankingResult}`
      }]
    };
  }
};
