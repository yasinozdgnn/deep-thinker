export const TOOL_LIST = `=== PROJECT-WIDE TOOLS (Autonomous Swarm) ===
1. delegate_to_swarm - **SUPER TOOL**: Use for any project-wide task, finding/fixing bugs across multiple files, building features, or general "fix project" requests. If NO specific file is mentioned in the prompt, USE THIS for bug finding. Turkish: "projeyi düzelt", "hataları bul", "yap", "oluştur".

=== PROJECT-WIDE ANALYSIS ===
2. read_project - Scan project structure and important files. Best for "what is this project?" or "list files".
3. analyze_directory - Analyze all code in a folder for architecture, security, or performance.
4. analyze_architecture - Review overall system design.

=== SINGLE-FILE OPERATIONS (Requires filePath) ===
5. read_file - Read specific file contents.
6. write_file - Save content to a specific file.
7. find_bugs - [Single-File] Analyze a SPECIFIC file for errors. Use only if a file path is provided!
8. refactor_code - [Single-File] Refactor/Fix a specific file.
9. explain_code - [Single-File] Explain one file.
10. add_comments - [Single-File] Add comments to one file.
11. generate_tests - [Single-File] Create tests for one file.

=== OTHER TOOLS ===
12. deep_think_chat - General questions.
13. list_directory - List files in a specific folder.
14. search_in_files - Search for text patterns.`;

export const CODE_QUALITY_REQUIREMENTS = `CODE QUALITY REQUIREMENTS (MANDATORY):
- SOLID Principles: SRP (Single Responsibility), OCP, LSP, ISP, DIP.
- DRY (Don't Repeat Yourself): Zero code duplication. Use utility functions.
- Clean Code: Meaningful naming, small functions, no excessive nesting.
- Performance: Efficient DOM manipulation, optimized SQL, lazy-loading patterns.
- Error Handling: Proper try-catch blocks, descriptive error messages.
- Modularity: High cohesion, low coupling. No monolithic files.`;

export const PREMIUM_UI_GUIDELINES = `PREMIUM UI DESIGN PRINCIPLES:
- Cyberpunk/Neon Aesthetics: Use smooth gradients, neon glows, and dark mode.
- Modern Typography: Use Inter, Roboto, or Outfit. No default serif fonts.
- Micro-Animations: Add hover effects, loading transitions, and smooth fades.
- Glassmorphism: Use backdrop-filter: blur() where appropriate.
- Responsive Design: Must work flawlessly on Mobile, Tablet, and Desktop.
- Performance: Ensure 60fps animations. Avoid heavy layout shifts.`;

export function buildToolDetectionPrompt(userPrompt) {
  return `Persona: Strategic Intent Dispatcher
Task: Select the BEST tool for the user's request. 

STRICT DISPATCHING RULES:
1. **Parameter Guard**: If a tool is labeled [Single-File] (like find_bugs, read_file) but the user DID NOT specify a file path, DO NOT choose it. 
2. **Project Fallback**: If the user asks a general question ("hata var mı?", "projeyi incele") without a file, choose a PROJECT-WIDE tool (delegate_to_swarm or read_project).
3. **Handle TR (Turkish)**: Map "hata var mı", "sorunları bul" to delegate_to_swarm if no file is mentioned.

User Request: "${userPrompt}"

${TOOL_LIST}

Response Format (JSON):
{
  "tool": "tool_name",
  "confidence": 0.0-1.0,
  "parameters": {
     "key": "value"
  },
  "reasoning": "Explain why this tool was chosen over others (mention if it was upgraded to project-wide due to missing parameters)"
}`;
}
