import { callAI, runGitCommand } from '../helpers/index.js';

export const gitOpsHandlers = {
  git_diff_explain: async (args) => {
    const diff = await runGitCommand(args.repoPath, "diff");
    if (!diff.trim()) {
      return {
        content: [{ type: "text", text: "No changes to explain." }],
      };
    }
    const prompt = `Explain these git changes in detail:\n\`\`\`diff\n${diff}\n\`\`\``;
    const result = await callAI(prompt);
    return {
      content: [{ type: "text", text: `[Deep Thinking]\n\n${result}` }],
    };
  },

  generate_commit_message: async (args) => {
    const diff = await runGitCommand(args.repoPath, "diff --staged");
    if (!diff.trim()) {
      return {
        content: [
          { type: "text", text: "No staged changes. Use 'git add' first." },
        ],
      };
    }
    const prompt = `Generate a concise, professional git commit message for these changes. Use conventional commits format (feat:, fix:, refactor:, etc.):\n\`\`\`diff\n${diff}\n\`\`\``;
    const result = await callAI(prompt);
    return {
      content: [{ type: "text", text: `[Deep Thinking]\n\n${result}` }],
    };
  },

  resolve_conflicts: async (args) => {
    const conflicts = await runGitCommand(args.repoPath, "diff --check");
    const prompt = `Analyze and provide resolution suggestions for git merge conflicts. ${args.conflictFile ? `File: ${args.conflictFile}` : ""}\n\nProvide:\n1. Conflict analysis\n2. Resolution suggestions for each conflict\n3. Automatic resolution where possible\n4. Manual resolution guide\n5. Risk assessment\n\nGit status output:\n${conflicts}`;
    const result = await callAI(prompt);
    return {
      content: [
        {
          type: "text",
          text: `[Deep Thinking - Conflict Resolution]\n\n${result}`,
        },
      ],
    };
  },

  branch_analyzer: async (args) => {
    const branches = await runGitCommand(args.repoPath, "branch -a");
    const targetBranch = args.targetBranch || "main";
    const prompt = `Analyze git branch strategy and provide merging recommendations. Target branch: ${targetBranch}\n\nProvide:\n1. Active branches list with divergence analysis\n2. Merging order recommendations\n3. Branch cleanup suggestions\n4. Feature flag needs\n5. Risk assessment\n\nBranch output:\n${branches}`;
    const result = await callAI(prompt);
    return {
      content: [
        {
          type: "text",
          text: `[Deep Thinking - Branch Strategy]\n\n${result}`,
        },
      ],
    };
  },

  pr_review: async (args) => {
    let prDiff = args.prDiff;
    if (!prDiff) {
      prDiff = await runGitCommand(args.repoPath, "diff HEAD^ HEAD");
    }
    const reviewType = args.reviewType || "code_review";
    const prompt = `Generate a comprehensive pull request review. Review type: ${reviewType}\n\nProvide:\n1. Code quality comments\n2. Security issues (if applicable)\n3. Performance concerns (if applicable)\n4. Best practice violations\n5. Actionable suggestions\n\nPR Diff:\n\`\`\`diff\n${prDiff}\n\`\`\``;
    const result = await callAI(prompt);
    return {
      content: [
        { type: "text", text: `[Deep Thinking - PR Review]\n\n${result}` },
      ],
    };
  },

  git_history: async (args) => {
    const depth = args.depth || 100;
    const history = await runGitCommand(
      args.repoPath,
      `log -n ${depth} --pretty=format:"%h|%an|%ae|%ad|%s"`,
    );
    const prompt = `Analyze git commit history and detect patterns. Analyzing ${depth} commits.\n\nProvide:\n1. Commit frequency analysis\n2. Common patterns detected\n3. Contributor activity\n4. Bug introduction tracking\n5. Release timeline recommendations\n\nHistory:\n${history}`;
    const result = await callAI(prompt);
    return {
      content: [
        {
          type: "text",
          text: `[Deep Thinking - Git History Analysis]\n\n${result}`,
        },
      ],
    };
  }
};
