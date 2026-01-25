const DEFAULT_TOOL_MAPPINGS = [
  { 
    name: 'read_file',
    patterns: [/read\s+file/i, /get\s+content/i, /show\s+file/i],
    category: 'file_ops'
  },
  { 
    name: 'write_file',
    patterns: [/write\s+file/i, /save\s+to/i, /create\s+file/i],
    category: 'file_ops'
  },
  { 
    name: 'refactor_code',
    patterns: [/refactor/i, /improve\s+code/i, /clean\s+up/i],
    category: 'code_quality'
  },
  { 
    name: 'find_bugs',
    patterns: [/find\s+bugs?/i, /debug/i, /issues?/i],
    category: 'code_quality'
  },
  { 
    name: 'security_scan',
    patterns: [/security/i, /vulnerabil/i, /owasp/i],
    category: 'security'
  },
  { 
    name: 'optimize_code',
    patterns: [/optimi[sz]e/i, /performance/i, /speed\s+up/i],
    category: 'performance'
  },
  { 
    name: 'generate_tests',
    patterns: [/test/i, /unit\s+test/i, /spec/i],
    category: 'testing'
  },
  { 
    name: 'generate_docs',
    patterns: [/document/i, /jsdoc/i, /readme/i],
    category: 'documentation'
  },
  { 
    name: 'explain_code',
    patterns: [/explain/i, /understand/i, /how\s+does/i],
    category: 'analysis'
  },
  { 
    name: 'search_in_files',
    patterns: [/search/i, /find\s+in/i, /grep/i],
    category: 'search'
  },
  { 
    name: 'analyze_directory',
    patterns: [/analy[sz]e\s+directory/i, /scan\s+folder/i],
    category: 'analysis'
  },
  { 
    name: 'read_project',
    patterns: [/project\s+structure/i, /overview/i],
    category: 'analysis'
  }
];

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.categories = new Map();
  }
  
  register(name, patterns, config = {}) {
    const tool = {
      name,
      patterns: Array.isArray(patterns) ? patterns : [patterns],
      category: config.category || 'general',
      description: config.description || '',
      requiresApproval: config.requiresApproval || false,
      timeout: config.timeout || 120000,
      ...config
    };
    
    this.tools.set(name, tool);
    
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set());
    }
    this.categories.get(tool.category).add(name);
    
    return this;
  }
  
  unregister(name) {
    const tool = this.tools.get(name);
    if (tool) {
      this.tools.delete(name);
      const category = this.categories.get(tool.category);
      if (category) {
        category.delete(name);
      }
    }
    return this;
  }
  
  get(name) {
    return this.tools.get(name);
  }
  
  has(name) {
    return this.tools.has(name);
  }
  
  findByPattern(text) {
    const textLower = text.toLowerCase();
    
    for (const [name, tool] of this.tools) {
      if (tool.patterns.some(p => p.test(textLower))) {
        return name;
      }
    }
    
    return null;
  }
  
  findAllByPattern(text) {
    const textLower = text.toLowerCase();
    const matches = [];
    
    for (const [name, tool] of this.tools) {
      const matchCount = tool.patterns.filter(p => p.test(textLower)).length;
      if (matchCount > 0) {
        matches.push({ name, matchCount, tool });
      }
    }
    
    return matches.sort((a, b) => b.matchCount - a.matchCount);
  }
  
  getByCategory(category) {
    const toolNames = this.categories.get(category);
    if (!toolNames) return [];
    
    return Array.from(toolNames).map(name => this.tools.get(name));
  }
  
  getCategories() {
    return Array.from(this.categories.keys());
  }
  
  getAll() {
    return Array.from(this.tools.values());
  }
  
  getAllNames() {
    return Array.from(this.tools.keys());
  }
  
  size() {
    return this.tools.size;
  }
  
  toJSON() {
    return {
      tools: Object.fromEntries(
        Array.from(this.tools.entries()).map(([name, tool]) => [
          name,
          { ...tool, patterns: tool.patterns.map(p => p.toString()) }
        ])
      ),
      categories: Object.fromEntries(
        Array.from(this.categories.entries()).map(([cat, names]) => [
          cat,
          Array.from(names)
        ])
      )
    };
  }
}

export function createDefaultRegistry() {
  const registry = new ToolRegistry();
  
  for (const mapping of DEFAULT_TOOL_MAPPINGS) {
    registry.register(mapping.name, mapping.patterns, {
      category: mapping.category
    });
  }
  
  return registry;
}

export const defaultRegistry = createDefaultRegistry();
