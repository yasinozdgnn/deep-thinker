import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export const projectHandlers = {
  create_project: async (args) => {
    const { projectPath, projectType, projectName } = args;
    const fullPath = path.resolve(projectPath, projectName);
    
    let command = '';
    let cmdArgs = [];

    switch (projectType.toLowerCase()) {
      case 'next':
      case 'nextjs':
        // npx create-next-app@latest my-app --typescript --tailwind --eslint
        command = 'npx';
        cmdArgs = ['create-next-app@latest', projectName, '--typescript', '--tailwind', '--eslint', '--use-npm', '--no-git', '--yes'];
        break;
      case 'react':
      case 'vite':
        // npm create vite@latest my-vue-app -- --template react-ts
        command = 'npm';
        cmdArgs = ['create', 'vite@latest', projectName, '--', '--template', 'react-ts', '--yes'];
        break;
      case 'express':
      case 'node':
        // Manual scaffold for express
        try {
            await fs.mkdir(fullPath, { recursive: true });
            await fs.writeFile(path.join(fullPath, 'package.json'), JSON.stringify({
                name: projectName,
                version: "1.0.0",
                main: "index.js",
                dependencies: { "express": "^4.18.2" }
            }, null, 2));
            await fs.writeFile(path.join(fullPath, 'index.js'), `const express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => res.send('Hello World!'));\n\napp.listen(3000, () => console.log('Server running on port 3000'));`);
            return { content: [{ type: "text", text: `✅ Express project created at ${fullPath}. Run 'npm install' to finish setup.` }] };
        } catch (e) {
            return { content: [{ type: "text", text: `❌ Failed to create project: ${e.message}` }], isError: true };
        }
      default:
        return { content: [{ type: "text", text: `❌ Unsupported project type: ${projectType}. Supported: next, react, express.` }], isError: true };
    }

    return new Promise((resolve) => {
      const proc = spawn(command, cmdArgs, {
        cwd: projectPath,
        shell: true,
        stdio: 'pipe' // Capture output
      });

      let output = '';
      
      proc.stdout.on('data', (data) => output += data.toString());
      proc.stderr.on('data', (data) => output += data.toString());

      proc.on('close', (code) => {
        if (code === 0) {
            resolve({
                content: [{ type: "text", text: `✅ Project '${projectName}' created successfully in ${fullPath}!\n\nOutput:\n${output.slice(0, 500)}...` }]
            });
        } else {
            resolve({
                content: [{ type: "text", text: `❌ Project creation failed (Exit Code: ${code}):\n${output}` }],
                isError: true
            });
        }
      });
    });
  },

  add_dependency: async (args) => {
    const { projectPath, packageName, isDev } = args;
    const command = 'npm';
    const cmdArgs = ['install', packageName, isDev ? '--save-dev' : '--save'];

    return new Promise((resolve) => {
        const proc = spawn(command, cmdArgs, {
            cwd: projectPath,
            shell: true,
            stdio: 'pipe'
        });

        let output = '';
        proc.stderr.on('data', (d) => output += d.toString()); // npm writes to stderr often

        proc.on('close', (code) => {
             resolve({
                content: [{ type: "text", text: code === 0 ? `✅ Added ${packageName}` : `❌ Failed to add dependency:\n${output}` }]
             });
        });
    });
  }
};
