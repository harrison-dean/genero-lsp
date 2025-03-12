import * as fs from 'fs';
import * as path from 'path';

export class Logger {
	private doLog: boolean = true;
    private static instance: Logger;
    private logFilePath: string;

    private constructor(logFileName: string) {
        this.logFilePath = path.join(__dirname, logFileName);
    }

    public static getInstance(logFileName: string): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(logFileName);
        }
        return Logger.instance;
    }

    public log(message: string): void {
		if (!this.doLog) return
        const timestamp = new Date().toISOString();
        const logMessage = `${timestamp} - ${message}\n`;
        fs.appendFile(this.logFilePath, logMessage, (err) => {
            if (err) {
                console.error('Failed to write to log file:', err);
            }
        });
    }
}

export default Logger;
