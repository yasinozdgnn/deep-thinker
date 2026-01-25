import fs from 'fs/promises';
import path from 'path';
import { readFileContent, writeFileContent, searchFiles, validateFilePath } from '../helpers/index.js';
import { callGLM } from '../helpers/index.js';
import { codeAnalysisHandlers } from './code-analysis.js';

export const fileOpsHandlers = {
  read_file: async (args) => {
    const validation = validateFilePath(args.filePath);
    if (!validation.valid) return validation.error;
    
    const content = await readFileContent(args.filePath);
    return { content: [{ type: "text", text: content }] };
  },

  write_file: async (args) => {
    const validation = validateFilePath(args.filePath);
    if (!validation.valid) return validation.error;
    
    await writeFileContent(args.filePath, args.content);
    return {
      content: [{ type: "text", text: `File saved: ${args.filePath}` }],
    };
  },

  list_directory: async (args) => {
    const files = await fs.readdir(args.dirPath, { withFileTypes: true });
    const list = files
      .map((f) => `${f.isDirectory() ? "[DIR]" : "[FILE]"} ${f.name}`)
      .join("\n");
    return {
      content: [{ type: "text", text: list || "Empty directory." }],
    };
  },

  search_in_files: async (args) => {
    const results = await searchFiles(
      args.dirPath,
      args.pattern,
      args.extensions,
    );
    const output = results.length
      ? results.map((r) => `${r.file}:${r.line} - ${r.content}`).join("\n")
      : "No matches found.";
    return { content: [{ type: "text", text: output }] };
  },

  read_project: async (args) => {
    const depth = args.depth || 3;
    const projectPath = args.projectPath || process.cwd();
    const importantFiles = [
      "package.json", "tsconfig.json", "vite.config.js", "vite.config.ts",
      "next.config.js", "next.config.ts", ".env.example", "README.md",
      "index.js", "index.ts", "main.js", "main.ts", "app.js", "app.ts",
      "src/index.js", "src/index.ts", "src/main.js", "src/main.ts", "src/App.tsx", "src/App.jsx"
    ];

    let projectInfo = `## Project: ${projectPath}\n\n`;

    // Read important files
    for (const file of importantFiles) {
      try {
        const content = await readFileContent(path.join(projectPath, file));
        projectInfo += `### ${file}\n\`\`\`\n${content.slice(0, 2000)}${content.length > 2000 ? "\n...(truncated)" : ""}\n\`\`\`\n\n`;
      } catch { }
    }

    // Scan directory structure
    async function scanDir(dir, currentDepth = 0, prefix = "") {
      if (currentDepth >= depth) return "";
      let structure = "";
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          structure += `${prefix}${entry.isDirectory() ? "📁" : "📄"} ${entry.name}\n`;
          if (entry.isDirectory()) {
            structure += await scanDir(path.join(dir, entry.name), currentDepth + 1, prefix + "  ");
          }
        }
      } catch { }
      return structure;
    }

    projectInfo += `### Directory Structure\n\`\`\`\n${await scanDir(projectPath)}\`\`\`\n`;

    return { content: [{ type: "text", text: projectInfo }] };
  },

  read_related_files: async (args) => {
    const validation = validateFilePath(args.filePath);
    if (!validation.valid) return validation.error;
    
    const maxFiles = args.maxFiles || 10;
    const mainContent = await readFileContent(args.filePath);
    const dir = path.dirname(args.filePath);

    // Extract imports
    const importPatterns = [
      /import\s+.*?\s+from\s+['"](\..*?)['"]/g,
      /require\s*\(\s*['"](\..*?)['"]\s*\)/g,
      /from\s+['"](\..*?)['"]/g
    ];

    const relatedPaths = new Set();
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(mainContent)) !== null) {
        relatedPaths.add(match[1]);
      }
    }

    let output = `## Main File: ${args.filePath}\n\`\`\`\n${mainContent}\n\`\`\`\n\n## Related Files:\n\n`;

    let filesRead = 0;
    for (const relPath of relatedPaths) {
      if (filesRead >= maxFiles) break;
      const extensions = ["", ".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"];
      for (const ext of extensions) {
        try {
          const fullPath = path.resolve(dir, relPath + ext);
          const content = await readFileContent(fullPath);
          output += `### ${relPath}${ext}\n\`\`\`\n${content.slice(0, 3000)}${content.length > 3000 ? "\n...(truncated)" : ""}\n\`\`\`\n\n`;
          filesRead++;
          break;
        } catch { }
      }
    }

    return { content: [{ type: "text", text: output }] };
  },

  analyze_directory: async (args) => {
    const extensions = (args.extensions || "js,ts,jsx,tsx,py").split(",").map(e => `.${e.trim()}`);
    const analysisType = args.analysisType || "overview";

    let allCode = "";
    let fileCount = 0;
    const maxTotalSize = 50000; // 50KB limit for GLM context

    async function collectFiles(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await collectFiles(fullPath);
          } else if (extensions.includes(path.extname(entry.name))) {
            if (allCode.length < maxTotalSize) {
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                allCode += `\n\n// === FILE: ${fullPath} ===\n${content}`;
                fileCount++;
              } catch { }
            }
          }
        }
      } catch { }
    }

    await collectFiles(args.dirPath);

    const analysisPrompts = {
      overview: `Provide a comprehensive overview of this codebase. Include: architecture, main components, entry points, dependencies, and how files relate to each other.`,
      bugs: `Analyze this entire codebase for bugs, issues, and potential problems. List all findings with file locations and severity levels. Then suggest fixes.`,
      security: `Perform a security audit on this codebase. Check for OWASP Top 10 vulnerabilities, hardcoded secrets, input validation issues, and authentication problems.`,
      performance: `Analyze this codebase for performance issues. Look for N+1 queries, memory leaks, inefficient algorithms, unnecessary re-renders, and optimization opportunities.`,
      architecture: `Review the architecture of this codebase. Evaluate: separation of concerns, SOLID principles, design patterns used, coupling/cohesion, and suggest improvements.`
    };

    const prompt = `${analysisPrompts[analysisType] || analysisPrompts.overview}\n\nCodebase (${fileCount} files):\n\`\`\`\n${allCode}\n\`\`\``;

    const result = await callGLM(prompt);

    // AUTO-FIX LOGIC
    let autoFixReport = "";
    if (args.autoFix) {
      const fixPrompt = `Based on the analysis above, identifying which files need fixing.
      
      Return a JSON array of objects, where each object has:
      - "filePath": The full path of the file to fix
      - "tool": The tool to use ("find_bugs", "security_scan", "optimize_code", or "refactor_code")
      - "instruction": Specific instruction for the tool
      
      Example:
      [
        {"filePath": "src/api.js", "tool": "find_bugs", "instruction": "Fix null pointer exception"},
        {"filePath": "src/utils.js", "tool": "optimize_code", "instruction": "Optimize regex"}
      ]
      
      Analysis Result:
      ${result}`;

      const fixPlanRaw = await callGLM(fixPrompt);
      let fixPlan = [];
      try {
        const jsonMatch = fixPlanRaw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            fixPlan = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
         autoFixReport = "\n\n⚠️ Failed to parse auto-fix plan.";
      }

      if (fixPlan.length > 0) {
        autoFixReport += "\n\n### 🛠️ Auto-Fix Execution Report\n";
        for (const task of fixPlan) {
            try {
                if (codeAnalysisHandlers[task.tool]) {
                    autoFixReport += `\n**Executing ${task.tool} on ${path.basename(task.filePath)}...**\n`;
                    const fixResult = await codeAnalysisHandlers[task.tool]({ 
                        filePath: task.filePath,
                        autoFix: true,
                        instructions: task.instruction 
                    });
                     // Extract the text content from the result
                    const fixText = fixResult.content && fixResult.content[0] ? fixResult.content[0].text : "Done.";
                    autoFixReport += `Result: ${fixText.split('\n')[0]} (See file for details)\n`;
                } else {
                    autoFixReport += `\n❌ Tool ${task.tool} not found for ${task.filePath}\n`;
                }
            } catch (err) {
                autoFixReport += `\n❌ Error fixing ${task.filePath}: ${err.message}\n`;
            }
        }
      } else {
        autoFixReport += "\n\n✅ No critical issues requiring auto-fix were identified.";
      }

      // FINAL CODE REVIEW
      if (fixPlan.length > 0) {
        autoFixReport += "\n\n### 🧐 Final Code Review\n";
        const modifiedFiles = fixPlan.map(t => t.filePath);
        const uniqueFiles = [...new Set(modifiedFiles)];
        
        for (const file of uniqueFiles) {
            try {
                const content = await readFileContent(file);
                
                // Get valid dependencies (context)
                let context = "";
                try {
                  const dir = path.dirname(file);
                  // Pattern for JS imports matches: from "..."
                  // Pattern for PHP imports matches: use ...; or require "..." or include "..."
                  const importRegex = /(?:from\s+['"](\..*?)['"])|(?:(?:require|include)(?:_once)?\s*\(?\s*['"](\..*?)['"]\s*\)?)|(?:use\s+([\\w\\]+)\s*;)/g; 
                  
                  let match;
                  while ((match = importRegex.exec(content)) !== null) {
                     // JS match is group 1, PHP require/include is group 2, PHP use is group 3
                     let relPath = match[1] || match[2];
                     const phpClass = match[3];

                     // Logic for PHP Namespace Resolution (simplistic mapping for MVP)
                     if (phpClass) {
                        // Convert App\Models\User -> models/User.php (heuristic)
                        // This often requires knowing PSR-4 config, but we can try common paths
                        // For now we skip "use" namespaces as they are hard to map to file paths without psr-4 logic
                        // We focus on relative file includes which are critical for legacy projects
                        continue; 
                     }
                     
                     if (!relPath) continue;

                     // Try to resolve extensions
                     const exts = ['', '.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js', '.php'];
                     for (const ext of exts) {
                        try {
                           const depPath = path.resolve(dir, relPath + ext);
                           if (depPath !== file) {
                               const depContent = await fs.readFile(depPath, 'utf8');
                               // Truncate to save context
                               context += `\n// Imported from ${relPath}:\n${depContent.slice(0, 1000)}\n...`;
                               break;
                           }
                        } catch {}
                     }
                  }
                } catch { }

                const reviewPrompt = `Review the changes made to this file. verify it works with the imports.
                File: ${file}
                
                File Content:
                \`\`\`
                ${content}
                \`\`\`

                Related Context (Imports):
                \`\`\`
                ${context || "No local imports found."}
                \`\`\`
                
                Did the auto-fix introduce any new syntax errors, logic issues, or TYPE MISMATCHES with imports? 
                Briefly confirm if it is clean or warn if issues remain.`;
                
                const review = await callGLM(reviewPrompt);
                autoFixReport += `\n**${path.basename(file)}**: ${review}\n`;
            } catch {}
        }
      }
    }

    return {
      content: [{
        type: "text",
        text: `[Deep Thinking - Directory Analysis: ${analysisType}]\n\nAnalyzed ${fileCount} files in ${args.dirPath}\n\n${result}${autoFixReport}`
      }]
    };
  }
};
