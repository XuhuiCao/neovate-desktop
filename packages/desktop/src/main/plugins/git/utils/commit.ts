import git from "simple-git";

export async function gitCommit(cwd: string, message: string, opts?: { noVerify?: boolean }) {
  const gitClient = git(cwd);
  const args = ["commit", "-m", message];
  if (opts?.noVerify) args.push("--no-verify");
  await gitClient.raw(args);
}
