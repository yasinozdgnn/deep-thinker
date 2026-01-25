import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function runGitCommand(repoPath, command) {
  try {
    const { stdout } = await execAsync(`git ${command}`, { cwd: repoPath });
    return stdout;
  } catch (error) {
    return error.message;
  }
}

export async function getGitDiff(repoPath, staged = false) {
  const command = staged ? 'diff --staged' : 'diff';
  return await runGitCommand(repoPath, command);
}

export async function getGitLog(repoPath, count = 10) {
  return await runGitCommand(repoPath, `log -n ${count} --oneline`);
}

export async function getGitStatus(repoPath) {
  return await runGitCommand(repoPath, 'status --porcelain');
}

export async function getGitBranches(repoPath) {
  return await runGitCommand(repoPath, 'branch -a');
}

export async function getGitConflicts(repoPath) {
  return await runGitCommand(repoPath, 'diff --name-only --diff-filter=U');
}
