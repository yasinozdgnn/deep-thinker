export const TOOL_LIST = `=== AUTONOMOUS AGENTS (4) ===
2. delegate_to_swarm - **SUPER TOOL**: Autonomous E2E Build. Plan -> Architect -> Code -> Verify -> QA. Use this for "Build X", "Create App", "Make Website".
3. plan_task - Create a granular execution plan for a task (without auto-execution)
4. execute_mission - **AUTOPILOT**: Execute a planned task loop until completion. Use this to run a plan automatically.
5. decompose_task - Break down complex task into subtasks

=== ARCHITECT TOOLS (3) ===
6. design_system - Design specific system architecture (Blueprint) - Use 'delegate_to_swarm' instead for full builds!
7. analyze_architecture - Analyze existing project architecture
8. visualize_architecture - Generate architecture diagrams (Mermaid)

=== CORE TOOLS (3) ===
1. deep_think_chat - Complex coding questions
2. deep_think_verbose - Deep thinking with visible reasoning
3. deep_think_code - Generate code and save to file

=== FILE OPERATIONS (5) ===
4. read_file - Read file contents
5. write_file - Write content to file
6. list_directory - List files in directory
7. search_in_files - Search for pattern in files
8. read_related_files - Read multiple related files intelligently

=== CODE ANALYSIS (6) ===
9. refactor_code - Refactor code and save
10. explain_code - Generate detailed explanation
11. add_comments - Add inline comments
12. find_bugs - Analyze code for bugs
13. optimize_code - Performance optimizations
14. find_references - Find symbol usages

=== GIT OPERATIONS (2) ===
15. git_diff_explain - Explain git diff
16. generate_commit_message - Generate commit message

=== TEST & DOCUMENTATION (3) ===
17. generate_tests - Generate unit tests
18. generate_docs - Generate JSDoc/TSDoc
19. create_readme - Generate README.md

=== PROJECT MANAGEMENT (2) ===
20. create_project - Create boilerplate project
21. add_dependency - Add dependency

=== DATABASE TOOLS (4) ===
22. analyze_query - SQL query performance analysis, N+1 detection
23. explain_schema - Database schema documentation, ER diagrams
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

export const CODE_QUALITY_REQUIREMENTS = `CODE QUALITY REQUIREMENTS (All generated code MUST follow):
- DRY (Don't Repeat Yourself): Reuse existing functions, avoid code duplication
- SOLID Principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- OOP Best Practices: Proper encapsulation, inheritance, polymorphism where applicable
- Project Structure Compatibility: Generated code must match existing project conventions, folder structure, naming patterns, and coding style`;

export function buildToolDetectionPrompt(userPrompt) {
  return `Given this user request, choose the BEST tool from our available tools.

User Request: "${userPrompt}"

Available Tools:

${TOOL_LIST}

Instructions:
1. Analyze the user's intent and context
2. Match with the most appropriate tool
3. Consider keyword clues (SQL, git, docker, security, optimize, test, analyze, etc.)
4. Confidence should be high (0.7+) for clear requests
5. If multiple tools could work, prioritize based on specificity

${CODE_QUALITY_REQUIREMENTS}

Response Format (strict JSON):
{
  "tool": "tool_name",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this tool was chosen"
}`;
}
