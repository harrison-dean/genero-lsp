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

		lines.forEach((line, lineNumber) => {
			// line = line.trim();
			// let indent = 0;

			// Parse FUNCTION definitions
			const functionMatch = line.match(/^FUNCTION\s+(\w+)\s*\(([^)]*)\)/i);
			if (functionMatch) {
				// indent++;

				currentFunction = {
					name: functionMatch[1],
					parameters: this.parseParameters(functionMatch[2]),
					returns: [],
					variables: [],
					startLine: lineNumber,
					endLine: -1
				};
				structure.functions.push(currentFunction);
				return;
			}

			// Parse END FUNCTION
			if (/^END\s+FUNCTION/i.test(line) && currentFunction) {
				currentFunction.endLine = lineNumber;
				currentFunction = null;
				return;
			}

			// Parse variable definitions
			const varMatch = line.trim().match(/^DEFINE\s+(\w+)\s+([\w.]+)/i);
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
				return;
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
				return;
			}

			// Parse function calls
			const callMatch = line.match(/^CALL\s+(\w+)/i);
			if (callMatch) {
				structure.calls.push({
					name: callMatch[1],
					line: lineNumber
				});
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
}

