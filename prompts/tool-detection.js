export const TOOL_LIST = `=== AUTONOMOUS AGENTS (4) ===
2. delegate_to_swarm - **SUPER TOOL**: Autonomous E2E Build. Plan -> Architect -> Code -> Verify -> QA. Use this for "Build X", "Create App", "Make Website". Turkish: "yap", "oluştur", "inşa et", "kur".
3. plan_task - Create a granular execution plan for a task (without auto-execution). Turkish: "planla", "taslak çıkar".
4. execute_mission - **AUTOPILOT**: Execute a planned task loop until completion. Use this to run a plan automatically.
5. decompose_task - Break down complex task into subtasks. Turkish: "parçala", "ayır".

=== ARCHITECT TOOLS (3) ===
6. design_system - Design specific system architecture (Blueprint) - Use 'delegate_to_swarm' instead for full builds!
7. analyze_architecture - Analyze existing project architecture. Turkish: "mimarini incele".
8. visualize_architecture - Generate architecture diagrams (Mermaid). Turkish: "çiz", "görselleştir".

=== CORE TOOLS (3) ===
1. deep_think_chat - Complex coding questions. Turkish: "sor", "danış".
2. deep_think_verbose - Deep thinking with visible reasoning
3. deep_think_code - Generate code and save to file. Turkish: "kod yaz".

=== FILE OPERATIONS (5) ===
4. read_file - Read file contents. Turkish: "oku", "içek", "bak".
5. write_file - Write content to file. Turkish: "yaz", "kaydet", "dosya oluştur".
6. list_directory - List files in directory. Turkish: "listele", "dosyaları göster".
7. search_in_files - Search for pattern in files. Turkish: "ara", "bul".
8. read_related_files - Read multiple related files intelligently

=== CODE ANALYSIS (6) ===
9. refactor_code - Refactor/Fix code and save. Turkish: "düzelt", "optimize et", "iyileştir", "hatasını gider".
10. explain_code - Generate detailed explanation. Turkish: "açıkla", "anlat".
11. add_comments - Add inline comments. Turkish: "yorum ekle".
12. find_bugs - Analyze code for bugs. Turkish: "hatayı bul".
13. optimize_code - Performance optimizations. Turkish: "hızlandır".
14. find_references - Find symbol usages

=== GIT OPERATIONS (2) ===
15. git_diff_explain - Explain git diff
16. generate_commit_message - Generate commit message

=== TEST & DOCUMENTATION (3) ===
17. generate_tests - Generate unit tests. Turkish: "test yaz", "test oluştur".
18. generate_docs - Generate JSDoc/TSDoc. Turkish: "dokümante et".
19. create_readme - Generate README.md. Turkish: "readme oluştur".

=== PROJECT MANAGEMENT (2) ===
20. create_project - Create boilerplate project. Turkish: "proje oluştur".
21. add_dependency - Add dependency. Turkish: "ekle", "kütüphane kur".

=== DATABASE TOOLS (4) ===
22. analyze_query - SQL query performance analysis, N+1 detection. Turkish: "sorguyu incele".
23. explain_schema - Database schema documentation, ER diagrams. Turkish: "şemayı anlat".
24. suggest_indexes - Optimal index recommendations
25. review_migration - Migration safety review

=== GIT ADVANCED TOOLS (4) ===
26. resolve_conflicts - Git conflict resolution
27. branch_analyzer - Branch strategy and merging
28. pr_review - Pull request review
29. git_history - Commit history analysis

=== CI/CD & DEVOPS TOOLS (4) ===
30. generate_dockerfile - Optimized Dockerfile (multi-stage)
31. generate_github_actions - CI/CD workflow
32. k8s_manifest - Kubernetes manifests
33. terraform_module - Terraform modules

=== TEST ADVANCED TOOLS (4) ===
34. generate_e2e_tests - Playwright/Cypress E2E tests
35. test_coverage_analysis - Test coverage gaps
36. mock_generator - API mocks (MSW, Nock)
37. load_test_script - Load testing (k6, artillery)

=== SECURITY & SAST TOOLS (4) ===
38. security_scan - OWASP Top 10 security scan
39. dependency_audit - Vulnerability detection
40. secrets_scanner - Hardcoded secrets detection
41. api_security - API endpoint security analysis

=== PERFORMANCE & OPTIMIZATION TOOLS (4) ===
42. bundle_analysis - Bundle size analysis
43. memory_leak_detect - Memory leak detection
44. api_response_time - API performance benchmark
45. caching_strategy - Caching recommendations

=== API & DOCUMENTATION TOOLS (4) ===
46. openapi_spec - OpenAPI/Swagger specification
47. api_client_generator - API client code
48. graphql_schema - GraphQL schema design
49. api_migration - REST to GraphQL migration

=== PROJECT STRATEGY TOOLS (4) ===
50. architecture_review - Architecture review
51. tech_stack_migration - Tech stack migration guide
52. scaling_strategy - Scaling strategy
53. cost_optimization - Cloud cost optimization`;

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
  return `Persona: Autonomous Intent Specialist
Task: Given the user's request, select the BEST tool and extract its required PARAMETERS.

Note: Handle Multilingual (EN/TR). Map Turkish keywords (oku, yaz, düzelt, yap) to the appropriate tools.

User Request: "${userPrompt}"

${TOOL_LIST}

STRICT INSTRUCTIONS:
1. Identify the tool that exactly matches the user's intent.
2. EXTRACT PARAMETERS: If the tool needs arguments (e.g. filePath, dirPath, content), find them in the prompt or infer them if obvious.
   - Example: "read README.md" -> tool: "read_file", parameters: { "filePath": "README.md" }
   - Example: "build a react app" -> tool: "delegate_to_swarm", parameters: { "task": "build a react app" }
3. Return ONLY a raw JSON object.

Response Format:
{
  "tool": "tool_name",
  "confidence": 0.0-1.0,
  "parameters": {
     "key": "value"
  },
  "reasoning": "Brief explanation"
}`;
}
