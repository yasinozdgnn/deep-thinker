import fs from 'fs/promises';
import path from 'path';
import { readFileContent, writeFileContent, searchFiles } from '../helpers/index.js';
import { callGLM } from '../helpers/index.js';

export const fileOpsHandlers = {
  read_file: async (args) => {
    const content = await readFileContent(args.filePath);
    return { content: [{ type: "text", text: content }] };
  },

  write_file: async (args) => {
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
    return {
      content: [{
        type: "text",
        text: `[Deep Thinking - Directory Analysis: ${analysisType}]\n\nAnalyzed ${fileCount} files in ${args.dirPath}\n\n${result}`
      }]
    };
  }
};
