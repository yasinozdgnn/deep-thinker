export const TOOL_LIST = `=== CORE TOOLS (3) ===
1. deep_think_chat - Complex coding questions
2. deep_think_verbose - Deep thinking with visible reasoning
3. deep_think_code - Generate code and save to file

=== FILE OPERATIONS (4) ===
4. read_file - Read file contents
5. write_file - Write content to file
6. list_directory - List files in directory
7. search_in_files - Search for pattern in files

=== CODE ANALYSIS (6) ===
8. refactor_code - Refactor code and save
9. explain_code - Generate detailed explanation
10. add_comments - Add inline comments
11. find_bugs - Analyze code for bugs
12. optimize_code - Performance optimizations
13. find_references - Find symbol usages

=== GIT OPERATIONS (2) ===
14. git_diff_explain - Explain git diff
15. generate_commit_message - Generate commit message

=== TEST & DOCUMENTATION (3) ===
16. generate_tests - Generate unit tests
17. generate_docs - Generate JSDoc/TSDoc
18. create_readme - Generate README.md

=== PROJECT MANAGEMENT (2) ===
19. create_project - Create boilerplate project
20. add_dependency - Add dependency

=== DATABASE TOOLS (4) ===
21. analyze_query - SQL query performance analysis, N+1 detection
22. explain_schema - Database schema documentation, ER diagrams
23. suggest_indexes - Optimal index recommendations
24. review_migration - Migration safety review

=== GIT ADVANCED TOOLS (4) ===
25. resolve_conflicts - Git conflict resolution
26. branch_analyzer - Branch strategy and merging
27. pr_review - Pull request review
28. git_history - Commit history analysis

=== CI/CD & DEVOPS TOOLS (4) ===
29. generate_dockerfile - Optimized Dockerfile (multi-stage)
30. generate_github_actions - CI/CD workflow
31. k8s_manifest - Kubernetes manifests
32. terraform_module - Terraform modules

=== TEST ADVANCED TOOLS (4) ===
33. generate_e2e_tests - Playwright/Cypress E2E tests
34. test_coverage_analysis - Test coverage gaps
35. mock_generator - API mocks (MSW, Nock)
36. load_test_script - Load testing (k6, artillery)

=== SECURITY & SAST TOOLS (4) ===
37. security_scan - OWASP Top 10 security scan
38. dependency_audit - Vulnerability detection
39. secrets_scanner - Hardcoded secrets detection
40. api_security - API endpoint security analysis

=== PERFORMANCE & OPTIMIZATION TOOLS (4) ===
41. bundle_analysis - Bundle size analysis
42. memory_leak_detect - Memory leak detection
43. api_response_time - API performance benchmark
44. caching_strategy - Caching recommendations

=== API & DOCUMENTATION TOOLS (4) ===
45. openapi_spec - OpenAPI/Swagger specification
46. api_client_generator - API client code
47. graphql_schema - GraphQL schema design
48. api_migration - REST to GraphQL migration

=== PROJECT STRATEGY TOOLS (4) ===
49. architecture_review - Architecture review
50. tech_stack_migration - Tech stack migration guide
51. scaling_strategy - Scaling strategy
52. cost_optimization - Cloud cost optimization`;

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
