import * as readline from "node:readline";

export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

export async function doubleConfirm(
  message: string,
  confirmWord: string,
): Promise<boolean> {
  const first = await confirm(message);
  if (!first) return false;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`Type "${confirmWord}" to confirm: `, (answer) => {
      rl.close();
      resolve(answer.trim() === confirmWord);
    });
  });
}
