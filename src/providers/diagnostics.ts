import {
	Diagnostic,
	DiagnosticSeverity,
} from 'vscode-languageserver/node';

// import { Diagnostic} from "../types/genero";
import { DocumentManager } from "../lib/documentManager";
import { compileFile } from '../utils/compileGeneroFile';
import { Logger } from "../utils/logger";
import { FileStructure } from "../types/genero";

// logger
const logger = Logger.getInstance("hd.log");

export class DiagnosticsProvider {
	constructor(private documentManager: DocumentManager) {}
	
	async provideDiagnostics(uri: string): Promise<Diagnostic[]> {
		logger.log("In provideDiagnostics()")
		logger.log(uri)

		try {
			// get diagnostics from compiler output
			const output = await compileFile(uri);
			const diagnostics = await this.parseDiagnostics(output);

			// get diagnostics from file structure
			const fileStructure: FileStructure | undefined = this.documentManager.getStructure(uri);
			let fileStructDiagnostics: Diagnostic[] = []
			if (fileStructure) {
				fileStructDiagnostics = fileStructure.diagnostics;
			}
			return [
				...diagnostics,
				...fileStructDiagnostics
			]
		} catch (error) {
			// logger.log(`Error compiling file: ${error}`);
			return []
		}

	}

	async parseDiagnostics(output: string): Promise<Diagnostic[]> {
		logger.log("in parseDiagnostics()");
		logger.log("output: " + output)
		const diagnostics: Diagnostic[] = [];
		const lines = output.split('\n');
		const regex = /^(.*):(\d+):(\d+):(\d+):(\d+):(warning|error):\((-\d+)\) (.*)$/;

		for (const line of lines) {
			const match = line.match(regex);
			if (match) {
				diagnostics.push({
					range: {
						start: { line: parseInt(match[2],10) - 1, character: parseInt(match[3],10) - 1 },
						end: { line: parseInt(match[4],10) - 1, character: parseInt(match[5],10) }
					},
					severity: match[6] === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
					code: parseInt(match[7]),
					source: 'fglcomp',
					message: match[8],
				})
			}
		}

		return diagnostics;
	}
}
