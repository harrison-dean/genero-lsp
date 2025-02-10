import {
	Diagnostic,
	DiagnosticSeverity,
} from 'vscode-languageserver/node';

import { FileStructure, FunctionDef, VariableDef } from '../types/genero';
import { Logger } from "../utils/logger";

// logger
const logger = Logger.getInstance("hd.log");

/////////////////
// file parser //
/////////////////

export class FileParser {
	parse(text: string): FileStructure {
		logger.log("In parse()")
		// logger.log("text: " + text)
		const lines = text.split('\n');
		const structure: FileStructure = {
			functions: [],
			variables: [],
			records: [],
			calls: [],
			diagnostics: []
		};

		let currentFunction: FunctionDef | null = null;

		let correctIndent = 0;
		lines.forEach((line, lineNumber) => {
			// line = line.trim();
			// store a version of this line stripped of comments for ease of parsing
			const commentlessLine = this.stripComments(line);
			logger.log("lineNumber=" + lineNumber + "\nline=" + line);
			
			// increase indent in MAIN
			if (line.match(/^MAIN/i)) {
				currentFunction = {
					name: "MAIN",
					parameters: [],
					returns: [],
					variables: [],
					startLine: lineNumber,
					endLine: -1
				};
				structure.functions.push(currentFunction);
				correctIndent++;
			}
			if (line.match(/^END MAIN/i) && currentFunction) {
				currentFunction.endLine = lineNumber;
				currentFunction = null;
				correctIndent--;
			}
			// Parse FUNCTION definitions
			if (/^FUNCTION\s+/i.test(line)) {
				let combined = commentlessLine;
				let index = lineNumber;
				while (!combined.includes(")") && index < lines.length) {
					index++;
					let nextLine = this.stripComments(lines[index]);
					combined += " " + nextLine.trim();
				}
				combined = combined.trim();
				const functionRegex = /^FUNCTION\s+(\w+)\s*\(([\s\S]*?)\)/i;
				const match = combined.match(functionRegex)
				if (match) {
					index++;
					
					currentFunction = {
						name: match[1],
						parameters: this.parseParameters(match[2]),
						returns: [],
						variables: [],
						startLine: lineNumber,
						endLine: -1
					};
					structure.functions.push(currentFunction);
				}
			}
			
			logger.log("currentFunction.name=" + (currentFunction ? currentFunction.name : ""));

	
			// parse function return value/type
			if (/RETURN\s+/i.test(commentlessLine)) {
				logger.log("returnLine");
				let combined = commentlessLine;
				let index = lineNumber;
				while (combined.trim().endsWith(",") && index < lines.length) {
					index++;
					const nextLine = this.stripComments(lines[index]);
					combined += " " + nextLine.trim();
				}
				combined = combined.trim();
				const returnsRegex = /^RETURN\s+(.*)/i;
				const match = combined.match(returnsRegex);
				if (match) {
					const returnVars = match[1].split(",/\s*");
					returnVars.forEach((v: string) => {
						if (currentFunction) {
							logger.log("returnVars: " + returnVars);
							const variableMatch = structure.variables.find(
								vm => currentFunction && (vm.name === v && (vm.scope === currentFunction.name))
							);
							if (variableMatch) {
								currentFunction.returns.push({name: variableMatch.name, type: variableMatch.type});
							}
						}
					})
				}
			}

			// Parse END FUNCTION
			if (/^END\s+FUNCTION.*/i.test(line) && currentFunction) {
				correctIndent--;
				currentFunction.endLine = lineNumber;
			
				// resolve parameter types from function.variables
				let cnt = 0
				currentFunction.parameters.forEach((param) => {
		
					const allVariables = structure.functions.reduce<VariableDef[]>(
						(acc, fn) => acc.concat(fn.variables),
						[...structure.variables] // Start with global variables
					);
					if (currentFunction) {
						const variableMatch = structure.variables.find(
							v => currentFunction && (v.name === param.name && (v.scope === currentFunction.name))
						);
						if (variableMatch) {
							currentFunction.parameters[cnt].type = variableMatch.type;
						}
					}
					cnt++;
				});

				currentFunction = null;
			}

			// Parse variable definitions
			const varMatch = line.trim().match(/^DEFINE\s+(\w+)\s+((?:(?!#).)*)/i);

			if (varMatch) {
				const variable = {
					name: varMatch[1],
					type: varMatch[2].trim(),
					scope: currentFunction ? currentFunction.name : 'modular',
					line: lineNumber
				};

				// add variable to function if in one and file structure
				if (currentFunction) {
					currentFunction.variables.push(variable);
				} 
				structure.variables.push(variable);
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
				// correctIndent++;		// account for RETURNING on next line
				structure.calls.push({
					name: callMatch[1],
					line: lineNumber
				});
			}

			// parse THEN statements for indent levels
			const ifMatch = line.match(/^\s*IF\s*.*THEN\s*$/i);
			const endIfMatch = line.match(/^\s*END IF/i);
			if (ifMatch) {
				correctIndent++;
				// return;
			}
			if (endIfMatch) {
				correctIndent--;
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
			// if ((!this.ignoreLines(line)) && (realIndentLevel != correctIndent) && (realIndentLevel >= 1)) {
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
	
	stripComments(line: string): string {
		const commentIndex = line.indexOf("#");
		if (commentIndex !== -1) {
			return line.substring(0, commentIndex).trim();
		}
		return line;
	}

	ignoreLines(line: string): boolean {
		if (line.match(/RETURNING/i)) {
			return true;
		}
		return false;
	}

}

