export const gitOpsTools = [
  {
    name: "git_diff_explain",
    description: "Explain current git diff changes.",
    inputSchema: {
      type: "object",
      properties: { repoPath: { type: "string", description: "Git repository path" } },
      required: ["repoPath"],
    },
  },
  {
    name: "generate_commit_message",
    description: "Generate commit message based on staged changes.",
    inputSchema: {
      type: "object",
      properties: { repoPath: { type: "string", description: "Git repository path" } },
      required: ["repoPath"],
    },
  },
  {
    name: "resolve_conflicts",
    description: "Provide resolution suggestions for git merge conflicts.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
        conflictFile: { type: "string", description: "Specific file with conflicts (optional)" },
      },
      required: ["repoPath"],
    },
  },
  {
    name: "branch_analyzer",
    description: "Analyze branch strategy and provide merging recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
        targetBranch: { type: "string", description: "Main branch name (default: main)" },
      },
      required: ["repoPath"],
    },
  },
  {
    name: "pr_review",
    description: "Generate pull request review comments.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
        prDiff: { type: "string", description: "PR diff string" },
        reviewType: { type: "string", description: "Review type: code_review, security_review, performance_review" },
      },
      required: ["repoPath"],
    },
  },
  {
    name: "git_history",
    description: "Analyze commit history and detect patterns.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Git repository path" },
        depth: { type: "number", description: "Number of commits to analyze (default: 100)" },
      },
      required: ["repoPath"],
    },
  },
];
