import { callGLM, extractCodeFromResponse, readFileContent, writeFileContent, searchFiles } from '../helpers/index.js';

export const codeAnalysisHandlers = {
  refactor_code: async (args) => {
    const code = await readFileContent(args.filePath);
    const prompt = `Refactor this code: ${args.instructions}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nReturn only the refactored code.`;
    const result = await callGLM(prompt);
    const newCode = extractCodeFromResponse(result);
    await writeFileContent(args.filePath, newCode);
    return {
      content: [
        {
          type: "text",
          text: `[Deep Thinking]\n\nRefactored: ${args.filePath}\n\n${result}`,
        },
      ],
    };
  },

  explain_code: async (args) => {
    const code = await readFileContent(args.filePath);
    const prompt = `Explain this code in detail:\n\`\`\`\n${code}\n\`\`\``;
    const result = await callGLM(prompt);
    return {
      content: [{ type: "text", text: `[Deep Thinking]\n\n${result}` }],
    };
  },

  add_comments: async (args) => {
    const code = await readFileContent(args.filePath);
    const prompt = `Add inline comments to this code explaining what each part does:\n\`\`\`\n${code}\n\`\`\`\n\nReturn only the commented code.`;
    const result = await callGLM(prompt);
    const newCode = extractCodeFromResponse(result);
    await writeFileContent(args.filePath, newCode);
    return {
      content: [
        {
          type: "text",
          text: `[Deep Thinking]\n\nComments added: ${args.filePath}`,
        },
      ],
    };
  },

  find_bugs: async (args) => {
    const code = await readFileContent(args.filePath);
    const autoFix = args.autoFix !== false; // Default to true for auto-fixing
    
    const prompt = autoFix
      ? `Analyze this code for bugs and issues. Then FIX all bugs and return the corrected code.

IMPORTANT: Return your response in this format:
1. First, list all bugs found with explanations
2. Then provide the COMPLETE fixed code in a code block

Code:
\`\`\`
${code}
\`\`\``
      : `Analyze this code for bugs, issues, and potential problems. List all findings with severity levels (Critical/High/Medium/Low).

Code:
\`\`\`
${code}
\`\`\``;
    
    const result = await callGLM(prompt);
    
    if (autoFix) {
      const fixedCode = extractCodeFromResponse(result);
      if (fixedCode && fixedCode.trim() !== code.trim()) {
        await writeFileContent(args.filePath, fixedCode);
        return {
          content: [{
            type: "text",
            text: `[Deep Thinking - Bug Analysis & Auto-Fix]\n\n${result}\n\n✅ File updated: ${args.filePath}`
          }]
        };
      }
    }
    
    return {
      content: [{
        type: "text",
        text: `[Deep Thinking - Bug Analysis]\n\n${result}`
      }]
    };
  },

  fix_bugs: async (args) => {
    const code = await readFileContent(args.filePath);
    const specificBug = args.specificBug || "";
    
    const prompt = specificBug
      ? `Fix this specific bug in the code: "${specificBug}"

Return your response in this format:
1. Explain the bug and why it causes issues
2. Explain the fix
3. Provide the COMPLETE fixed code in a code block

Code:
\`\`\`
${code}
\`\`\``
      : `Analyze this code for ALL bugs and issues, then fix them.

Return your response in this format:
1. List all bugs found with explanations
2. Provide the COMPLETE fixed code in a code block (with ALL fixes applied)

Code:
\`\`\`
${code}
\`\`\``;
    
    const result = await callGLM(prompt);
    const fixedCode = extractCodeFromResponse(result);
    
    if (fixedCode && fixedCode.trim() !== code.trim()) {
      await writeFileContent(args.filePath, fixedCode);
      return {
        content: [{
          type: "text",
          text: `[Deep Thinking - Bug Fix Applied]\n\n${result}\n\n✅ File saved: ${args.filePath}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `[Deep Thinking - Bug Fix]\n\n${result}\n\n⚠️ No changes detected or code already correct.`
      }]
    };
  },

  optimize_code: async (args) => {
    const code = await readFileContent(args.filePath);
    const prompt = `Analyze this code for performance issues. Then APPLY all optimizations and return the optimized code.

IMPORTANT: Return your response in this format:
1. First, list all performance issues with explanations
2. Then provide the COMPLETE optimized code in a code block

Code:
\`\`\`
${code}
\`\`\``;
    const result = await callGLM(prompt);
    const optimizedCode = extractCodeFromResponse(result);
    if (optimizedCode && optimizedCode.trim() !== code.trim()) {
      await writeFileContent(args.filePath, optimizedCode);
    }
    return {
      content: [{
        type: "text",
        text: `[Deep Thinking - Performance Optimization]\n\n${result}\n\n✅ File updated: ${args.filePath}`
      }]
    };
  },

  find_references: async (args) => {
    const results = await searchFiles(
      args.dirPath,
      args.symbol,
      "js,ts,jsx,tsx,py,java,cs",
    );
    const output = results.length
      ? results.map((r) => `${r.file}:${r.line} - ${r.content}`).join("\n")
      : "No references found.";
    return { content: [{ type: "text", text: output }] };
  }
};
