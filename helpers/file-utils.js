import fs from 'fs/promises';
import path from 'path';

export async function readFileContent(filePath) {
  return await fs.readFile(filePath, 'utf-8');
}

export async function writeFileContent(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function searchFiles(dirPath, pattern, extensions) {
  const results = [];
  const regex = new RegExp(pattern, 'gi');
  const extList = extensions
    ? extensions.split(',').map((e) => `.${e.trim()}`)
    : null;

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules'
      ) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (extList && !extList.includes(path.extname(entry.name))) continue;
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          lines.forEach((line, i) => {
            if (regex.test(line)) {
              results.push({
                file: fullPath,
                line: i + 1,
                content: line.trim(),
              });
            }
          });
        } catch {}
      }
    }
  }
  await walk(dirPath);
  return results;
}

export async function listDirectory(dirPath, options = {}) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
    type: entry.isDirectory() ? 'directory' : 'file',
  }));
}

export async function scanProjectStructure(projectPath, depth = 3) {
  async function scanDir(dir, currentDepth = 0, prefix = '') {
    if (currentDepth >= depth) return '';
    let structure = '';
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        structure += `${prefix}${entry.isDirectory() ? '📁' : '📄'} ${entry.name}\n`;
        if (entry.isDirectory()) {
          structure += await scanDir(path.join(dir, entry.name), currentDepth + 1, prefix + '  ');
        }
      }
    } catch {}
    return structure;
  }
  return await scanDir(projectPath);
}

export async function readImportantProjectFiles(projectPath) {
  const importantFiles = [
    'package.json', 'tsconfig.json', 'vite.config.js', 'vite.config.ts',
    'next.config.js', 'next.config.ts', '.env.example', 'README.md',
    'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
    'src/index.js', 'src/index.ts', 'src/main.js', 'src/main.ts', 'src/App.tsx', 'src/App.jsx'
  ];

  const results = {};
  for (const file of importantFiles) {
    try {
      const content = await readFileContent(path.join(projectPath, file));
      results[file] = content.slice(0, 2000) + (content.length > 2000 ? '\n...(truncated)' : '');
    } catch {}
  }
  return results;
}

export async function collectDirectoryFiles(dirPath, extensions, maxTotalSize = 50000) {
  const extList = extensions.split(',').map(e => `.${e.trim()}`);
  let allCode = '';
  let fileCount = 0;

  async function collectFiles(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await collectFiles(fullPath);
        } else if (extList.includes(path.extname(entry.name))) {
          if (allCode.length < maxTotalSize) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              allCode += `\n\n// === FILE: ${fullPath} ===\n${content}`;
              fileCount++;
            } catch {}
          }
        }
      }
    } catch {}
  }

  await collectFiles(dirPath);
  return { allCode, fileCount };
}
