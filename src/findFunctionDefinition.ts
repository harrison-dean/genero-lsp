import { exec } from 'child_process';
import { Logger } from "./logger";
export function searchFunctionDefinition(functionName: string): Promise<{ filePath: string, line: number } | null> {
	// logger
	const logger = Logger.getInstance("hd.log");
	const curDir = process.cwd();
	const cmd: string = `rg --type-add "4gl:*.4gl" "FUNCTION\\s+${functionName}\\s*\\(" --vimgrep ${curDir}`

	return new Promise((resolve, reject) => {
	exec(cmd, (error, stdout, stderr) => {
		if (error) {
			resolve(null);
		} else {
		const match = stdout.split('\n')[0];
		if (match) {
			const parts = match.split(':');
			if (parts.length >= 2) {
			resolve({ filePath: parts[0], line: parseInt(parts[1], 10) });
			} else {
			resolve(null);
			}
		} else {
			resolve(null);
		}
		}
	});
	});
	}
