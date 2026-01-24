# GLM Deep Thinking MCP - Advanced Coder Agent

MCP (Model Context Protocol) server that enables GLM-4.7 Deep Thinking mode for Cursor IDE with **50+ advanced tools** and **auto-fix capabilities**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Why This Project?

While using Cursor with GLM models via API key, I noticed that the Deep Thinking feature wasn't actually working. The model wasn't being used to its full potential.

**Problems:**

- GLM Deep Thinking mode is not enabled by default in Cursor
- The `thinking` parameter is not sent via API
- The model's deep analysis capability cannot be used in large projects

**Solution:**
This MCP server fully enables GLM's Deep Thinking feature with a professional coder agent workflow. Use GLM as a **secondary AI agent** within Cursor to reduce costs and leverage deep thinking capabilities.

**Why GLM?**

- One of the most powerful open-source models available
- Superior performance in complex coding tasks with Deep Thinking mode
- Lower cost compared to Claude/GPT for heavy lifting tasks
- Secure usage with local MCP server

---

## Key Features

### 4-Phase Deep Thinking System

GLM operates with a professional coder agent workflow:

| Phase                             | Description                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1: Problem Anticipation** | Proactively identifies edge cases, error scenarios, race conditions, security concerns, and performance issues BEFORE writing code |
| **Phase 2: Defensive Coding**     | Writes code that handles all identified issues with proper error handling and input validation                                     |
| **Phase 3: Self-Review**          | Reviews its own code for correctness, edge cases, error handling, code quality, and security                                       |
| **Phase 4: Syntax Validation**    | Ensures syntactically correct code with balanced brackets, semicolons, imports, and proper indentation                             |

### AI-Powered Tool Selection (auto_detect)

No need to remember tool names! Just describe what you want:

```
Use glm-deepthinker: optimize this code for performance
```

The `auto_detect` tool automatically analyzes your request and selects the best tool:

- "find bugs" → `find_bugs`
- "security check" → `security_scan`
- "make it faster" → `optimize_code`
- "explain this" → `explain_code`

### Auto-Fix Tools

These tools automatically analyze AND fix issues, then update the file:

| Tool            | Action                                                  |
| --------------- | ------------------------------------------------------- |
| `find_bugs`     | Detects bugs and fixes them automatically               |
| `optimize_code` | Identifies performance issues and applies optimizations |
| `security_scan` | Performs OWASP Top 10 scan and patches vulnerabilities  |

### 50+ Available Tools

<details>
<summary>Click to expand full tool list</summary>

#### Core Tools (3)

- `deep_think_chat` - Deep thinking for complex questions
- `deep_think_verbose` - Deep thinking with visible reasoning process
- `deep_think_code` - Generate code and save to file

#### File Operations (4)

- `read_file`, `write_file`, `list_directory`, `search_in_files`

#### Code Analysis & Auto-Fix (6)

- `refactor_code` - Refactor and save
- `explain_code` - Generate explanation
- `add_comments` - Add inline comments
- `find_bugs` - **Auto-fix** bugs
- `optimize_code` - **Auto-fix** performance issues
- `find_references` - Find symbol usages

#### Git Operations (6)

- `git_diff_explain`, `generate_commit_message`
- `resolve_conflicts`, `branch_analyzer`, `pr_review`, `git_history`

#### Test & Documentation (6)

- `generate_tests`, `generate_docs`, `create_readme`
- `generate_e2e_tests`, `test_coverage_analysis`, `mock_generator`, `load_test_script`

#### CI/CD & DevOps (4)

- `generate_dockerfile`, `generate_github_actions`, `k8s_manifest`, `terraform_module`

#### Database Tools (4)

- `analyze_query`, `explain_schema`, `suggest_indexes`, `review_migration`

#### Security & SAST (4)

- `security_scan` - **Auto-fix** vulnerabilities
- `dependency_audit`, `secrets_scanner`, `api_security`

#### Performance & Optimization (4)

- `bundle_analysis`, `memory_leak_detect`, `api_response_time`, `caching_strategy`

#### API & Documentation (4)

- `openapi_spec`, `api_client_generator`, `graphql_schema`, `api_migration`

#### Project Strategy (4)

- `architecture_review`, `tech_stack_migration`, `scaling_strategy`, `cost_optimization`

#### Project Management (2)

- `create_project`, `add_dependency`

#### Agent Capabilities (8)

- `plan_task` - Create execution plan for complex tasks
- `execute_plan` - Execute plan with checkpointing
- `run_workflow` - Run predefined workflows
- `remember`, `recall`, `get_insights` - Memory operations
- `list_workflows` - List available workflows

#### **NEW: Advanced Agent Features (4)**

- `decompose_task` - **AI-powered task decomposition** with dependency resolution
- `execute_parallel` - **Parallel mini-agents** for concurrent execution
- `get_strategy_suggestion` - **Adaptive learning** based strategy recommendations
- `analyze_performance` - **Performance analysis** with pattern detection

</details>

### 🧠 Advanced Agent System (NEW!)

The server now includes a sophisticated agent system with self-improvement capabilities:

| Feature                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| **Task Decomposition**   | AI breaks complex tasks into subtasks with dependency graphs |
| **Parallel Mini-Agents** | Execute multiple subtasks concurrently with automatic retry  |
| **Retry & Validation**   | Exponential backoff, jitter, intelligent retry decisions     |
| **Adaptive Learning**    | System learns optimal strategies from execution history      |
| **Pattern Recognition**  | Detects success/error patterns and generates recommendations |

```
┌─────────────────────────────────────────────────────────────┐
│                    Task Decomposition                        │
├─────────────────────────────────────────────────────────────┤
│  Complex Task → Subtask 1 ──┐                               │
│               → Subtask 2 ──┼── Parallel Group 1            │
│               → Subtask 3 ──┘                               │
│               → Subtask 4 ────── Sequential (depends on 1-3)│
│               → Subtask 5 ──┬── Parallel Group 2            │
│               → Subtask 6 ──┘                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture: Dual-Agent System

```
┌─────────────────────────────────────────────┐
│                CURSOR IDE                    │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────┐   ┌─────────────────┐  │
│  │  Claude/GPT     │◄──┤  GLM-DeepThinker│  │
│  │  (Main Agent)   │MCP│  (Coder Agent)  │  │
│  │                 │   │                 │  │
│  │  • Orchestrate  │   │  • Deep Think   │  │
│  │  • UI control   │   │  • Auto-fix     │  │
│  │  • Quick edits  │   │  • Security     │  │
│  │                 │   │  • Optimize     │  │
│  └─────────────────┘   └─────────────────┘  │
│                                              │
└─────────────────────────────────────────────┘
```

**Cost Optimization:**

- Use Cursor's agent for orchestration and simple tasks
- Delegate heavy thinking (refactoring, security scans, deep analysis) to GLM
- Save your Cursor subscription limits for quick interactions

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yasinelbuz/glm-think-mcp.git
cd glm-think-mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Get GLM API Key

1. Go to [api.z.ai](https://api.z.ai)
2. Create an account or sign in
3. Create a new API key in the API Keys section
4. Copy the key

### 4. Add MCP Server to Cursor

1. Open Cursor
2. Open Settings with `Ctrl + Shift + J`
3. Go to `Features` → `MCP Servers`
4. Click `+ Add new MCP server`
5. Enter:

```json
{
  "glm-deepthinker": {
    "command": "node",
    "args": ["C:/path/to/glm-think-mcp/index.js"],
    "env": {
      "GLM_API_KEY": "YOUR_API_KEY_HERE"
    }
  }
}
```

6. Restart Cursor

---

## Recommended Cursor Rules

Add these rules to your project's `.cursor/rules` file to maximize MCP usage:

```
# GLM Deep Thinker MCP Integration

Always use glm-deepthinker MCP tools for:
- Complex code analysis and refactoring
- Security scans and vulnerability fixes
- Performance optimization
- Bug detection and auto-fix
- Architecture reviews
- Test generation

When coding:
1. Use analyze_directory for understanding new codebases
2. Use read_related_files before modifying interconnected files
3. Use find_bugs and security_scan before committing
4. Use deep_think_verbose for complex architectural decisions

Prefer MCP tools over built-in capabilities for heavy thinking tasks.
```

---

## Usage Examples

### Auto-Fix Bugs

```
Use glm-deepthinker find_bugs on C:/project/src/api.js
```

→ Analyzes, fixes all bugs, and updates the file automatically

### Security Scan & Fix

```
Use glm-deepthinker security_scan on C:/project/src/auth.js
```

→ Performs OWASP Top 10 scan and patches vulnerabilities

### Performance Optimization

```
Use glm-deepthinker optimize_code on C:/project/src/utils.js
```

→ Identifies N+1 queries, inefficient loops, and optimizes

### Deep Code Analysis

```
Use glm-deepthinker deep_think_verbose: How should I design a rate limiter for this API?
```

→ Shows full reasoning process with the final answer

### Generate Tests

```
Use glm-deepthinker generate_tests for C:/project/src/payment.js using jest
```

→ Creates comprehensive unit tests

### 🆕 Decompose Complex Task

```
Use glm-deepthinker decompose_task: "Analyze security, find bugs, optimize performance, and generate tests for the entire project"
```

→ AI breaks it into subtasks: security_scan → find_bugs → optimize_code → generate_tests
→ Creates dependency graph and parallel execution groups
→ Optionally executes all subtasks automatically

### 🆕 Parallel Execution

```json
Use glm-deepthinker execute_parallel with tasks: [
  {"tool": "read_file", "args": {"filePath": "api.js"}},
  {"tool": "read_file", "args": {"filePath": "auth.js"}},
  {"tool": "read_file", "args": {"filePath": "utils.js"}}
]
```

→ Runs all tasks concurrently with mini-agents
→ Automatic retry with exponential backoff
→ Aggregates results from all agents

### 🆕 Strategy Suggestion

```
Use glm-deepthinker get_strategy_suggestion for taskType: "code_review"
```

→ Returns best-performing tools based on historical data
→ Shows success rates, estimated times, and confidence scores
→ System learns and improves recommendations over time

### 🆕 Performance Analysis

```
Use glm-deepthinker analyze_performance for project
```

→ Shows tool performance metrics
→ Detects success/error patterns
→ Generates optimization recommendations

---

## Proxy Mode (For Other Applications)

The proxy server provides GLM Deep Thinking as an OpenAI-compatible API.

```bash
# Start proxy
$env:GLM_API_KEY="your-key"; node proxy.js

# Use with any OpenAI-compatible client
curl -X POST http://localhost:3456 \
  -H "Content-Type: application/json" \
  -d '{"model":"glm-4.7","messages":[{"role":"user","content":"Hello"}]}'
```

---

## Compatibility

| Tool               | Status          |
| ------------------ | --------------- |
| Cursor             | ✅ Full support |
| Claude Desktop     | ✅ Full support |
| VS Code + Continue | ✅ Supported    |
| Zed Editor         | ✅ Supported    |
| Cline              | ✅ Supported    |
| Custom Apps        | ✅ MCP SDK      |

---

## Requirements

- Node.js 18+
- GLM API Key ([api.z.ai](https://api.z.ai))
- Cursor IDE (or any MCP-compatible tool)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

MIT
