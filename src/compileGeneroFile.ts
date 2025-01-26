import { exec } from 'child_process';

export function compileGeneroFile(filePath: string): Promise<string> {
	console.log(filePath);
  return new Promise((resolve, reject) => {
    exec(`fglcomp -M -W all ${filePath}`, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}
