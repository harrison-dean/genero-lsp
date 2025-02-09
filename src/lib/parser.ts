import {
	Diagnostic,
	DiagnosticSeverity,
} from 'vscode-languageserver/node';

import { FileStructure, FunctionDef } from '../types/genero';
import { Logger } from "../logger";

// logger
const logger = Logger.getInstance("hd.log");

/////////////////
// file parser //
/////////////////

export class FileParser {
	parse(text: string): FileStructure {
		logger.log("In parse()")
		logger.log("text: " + text)
		const lines = text.split('\n');
		const structure: FileStructure = {
			functions: [],
			variables: [],
			records: [],
			calls: [],
			diagnostics: []
		};

		let currentFunction: FunctionDef | null = null;

		let indent = 0;
		lines.forEach((line, lineNumber) => {
			// line = line.trim();
			
			// increase indent in MAIN
			if (line.match(/^MAIN/i)) {
				indent++;
			}
			if (line.match(/^END MAIN/i)) {
				indent--;
			}
			// Parse FUNCTION definitions
			const functionMatch = line.match(/^FUNCTION\s+(\w+)\s*\(([^)]*)\)/i);
			if (functionMatch) {
				indent++;

				currentFunction = {
					name: functionMatch[1],
					parameters: this.parseParameters(functionMatch[2]),
					returns: [],
					variables: [],
					startLine: lineNumber,
					endLine: -1
				};
				structure.functions.push(currentFunction);
			}

			// Parse END FUNCTION
			if (/^END\s+FUNCTION.*/i.test(line) && currentFunction) {
				indent--;
				currentFunction.endLine = lineNumber;
				currentFunction = null;
			}

			// Parse variable definitions
			const varMatch = line.trim().match(/^DEFINE\s+(\w+)\s+((?:(?!#).)*)/i);

			if (varMatch) {
				const variable = {
					name: varMatch[1],
					type: varMatch[2],
					scope: currentFunction ? currentFunction.name : 'modular',
					line: lineNumber
				};

				if (currentFunction) {
					currentFunction.variables.push(variable);
				} else {
					structure.variables.push(variable);
				}
			}

			// Parse record definitions
			const recordMatch = line.match(/^DEFINE\s+(\w+)\s+RECORD/i);
			if (recordMatch) {
				const record: RecordDef = {
					name: recordMatch[1],
					fields: [],
					line: lineNumber
				};

				// Parse record fields
				let i = lineNumber + 1;
				while (i < lines.length && !/END\s+RECORD/i.test(lines[i])) {
					const fieldMatch = lines[i].match(/^\s*(\w+)\s+([\w.]+)/);
					if (fieldMatch) {
						record.fields.push({
							name: fieldMatch[1],
							type: fieldMatch[2]
						});
					}
					i++;
				}

				structure.records.push(record);
			}

			// Parse function calls
			const callMatch = line.match(/^CALL\s+(\w+)/i);
			if (callMatch) {
				// indent++;		// account for RETURNING on next line
				structure.calls.push({
					name: callMatch[1],
					line: lineNumber
				});
			}

			// parse THEN statements for indent levels
			const ifMatch = line.match(/^\s*IF\s*.*THEN\s*$/i);
			const endIfMatch = line.match(/^\s*END IF/i);
			if (ifMatch) {
				indent++;
				return;
			}
			if (endIfMatch) {
				indent--;
			}

			// check if line is all spaces or tabs (empty)
			const emptyLineRegex = /^[ \t]+$/
			const isEmptyLine = line.match(emptyLineRegex);
      		if (isEmptyLine) {
				structure.diagnostics.push({
					severity: DiagnosticSeverity.Hint,
					range: { start: { line: lineNumber, character: 0 },
							 end: { line: lineNumber, character: line.length }
					},
					message: "Empty line",
					source: "genero-lsp",
					code: "style/empty-line",
				})
			}

			// check if trailing spaces on line (unless line is already identified as empty)
			const trailingSpaceRegex = /[ \t]+$/
			const hasTrailingSpace = line.match(trailingSpaceRegex);
      		if (hasTrailingSpace && !isEmptyLine) {
				structure.diagnostics.push({
					severity: DiagnosticSeverity.Hint,
					range: { start: { line: lineNumber, character: line.length - hasTrailingSpace[0].length },
							 end: { line: lineNumber, character: line.length }
					},
					message: "Trailing whitespace",
					source: "genero-lsp",
					code: "style/trailing-whitespace",

				})
			}

			// check if current line count of \t(abs) is correct
			// const realIndentLevel: number = this.countIndentation(line);
			// if ((realIndentLevel != indent) && (realIndentLevel >= 1)) {
			// 	structure.diagnostics.push({
			// 		severity: DiagnosticSeverity.Hint,
			// 		range: { start: { line: lineNumber, character: line.length },
			// 				 end: { line: lineNumber, character: line.length }
			// 		},
			// 		message: "Incorrect indent level",
			// 		source: "genero-lsp",
			// 		code: "style/incorrect-indent",
			// 	})
			// }
		});

		return structure;
	}

	private parseParameters(paramString: string): Parameter[] {
		logger.log("in parseParameters()")
		logger.log("paramString:"  + paramString)
		return paramString.split(',')
			.map(p => p.trim())
			.filter(p => p.length > 0)
			.map(p => {
				const [name, type] = p.split(/\s+/);
				return { name, type: type || 'unknown' };
			});
	}

	countIndentation(line: string): number {
		let tabs = 0;
		for (const char of line) {
			if (char === "\t") {
				tabs++;
	
			} else {
				break;
			}
		}
		return tabs
	}
}

