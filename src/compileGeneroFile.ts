import { URL } from 'url';
import { exec } from 'child_process';

export function compileFile(fileUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = new URL(fileUri).pathname;
    exec(`fglcomp -M -W all ${filePath}`, (error, stdout, stderr) => {
      if (error) {
        // Resolve with both stdout and stderr
        resolve(`${stdout}\n${stderr}`);
      } else {
        resolve(`${stdout}\n${stderr}`);
      }
    });
  });
}
