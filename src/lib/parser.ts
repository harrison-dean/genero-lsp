import {
	DiagnosticSeverity,
} from 'vscode-languageserver/node';

import { FileStructure, 
	FunctionDef, 
	RecordDef, 
	VariableDef, 
	Parameter 
} from '../types/genero';
import { Logger } from "../utils/logger";
import { compileSchema } from '../utils/schemaLoader';

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
			diagnostics: [],
		};

		let currentFunction: FunctionDef | null = null;

		let correctIndent = 0;
		lines.forEach((line, lineNumber) => {
			// store a version of this line stripped of comments for ease of parsing
			const commentlessLine = this.stripComments(line);
			logger.log("lineNumber=" + lineNumber + "\nline=" + line);
			
			// increase indent in MAIN
			if (commentlessLine.match(/^MAIN/i)) {
				currentFunction = {
					name: "MAIN",
					parameters: [],
					returns: [],
					variables: [],
					startLine: lineNumber,
					endLine: -1,
					references: [],
				};
				structure.functions.push(currentFunction);
				correctIndent = 1;
			}
			if (commentlessLine.match(/^END MAIN/i) && currentFunction) {
				currentFunction.endLine = lineNumber;
				currentFunction = null;
				// correctIndent--;
			}
			// Parse FUNCTION/REPORT definitions
			if (/^FUNCTION\s+/i.test(commentlessLine) || /^REPORT\s/i.test(commentlessLine)) {
				correctIndent = 1;
				let combined = commentlessLine;
				let index = lineNumber;
				while (!combined.includes(")") && index < lines.length) {
					index++;
					let nextLine = this.stripComments(lines[index]);
					combined += " " + nextLine.trim();
				}
				combined = combined.trim();
				const functionRegex = /^FUNCTION\s+(\w+)\s*\(([\s\S]*?)\)/i;
				const reportRegex = /^REPORT\s+(\w+)\s*\(([\s\S]*?)\)/i;
				let match = combined.match(functionRegex);
				if (match) {
					
					currentFunction = {
						name: match[1],
						parameters: this.parseParameters(match[2]),
						returns: [],
						variables: [],
						startLine: lineNumber,
						endLine: -1,
						references: [],
					};
					structure.functions.push(currentFunction);
				} else {
					match = combined.match(reportRegex);
					if (match) {
						index++;
						currentFunction = {
							name: match[1],
							parameters: this.parseParameters(match[2]),
							returns: [],
							variables: [],
							startLine: lineNumber,
							endLine: -1, 
							references: [],
						};
						structure.functions.push(currentFunction);
					}
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

			// Parse END FUNCTION/REPORT
			if ((/^END\s+FUNCTION/i.test(commentlessLine) || /^END\s+REPORT/i.test(commentlessLine)) && currentFunction) {
				// correctIndent--;
				currentFunction.endLine = lineNumber;
			
				// resolve parameter types from function.variables
				let cnt = 0
				currentFunction.parameters.forEach((param) => {
		
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
			const varMatch = commentlessLine.trim().match(/^DEFINE\s+(\w+)\s+((?:(?!#).)*)/i);

			if (varMatch) {
				const variable: VariableDef = {
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
			const recordMatch = commentlessLine.match(/DEFINE\s+(\w+)\s+RECORD/i);
			if (recordMatch) {
				const record: RecordDef = {
					name: recordMatch[1],
					fields: [],
					scope: currentFunction ? currentFunction.name : 'modular',
					line: lineNumber
				};

				// Parse record fields
				let i = lineNumber + 1;
				while (i < lines.length && !/END\s+RECORD/i.test(this.stripComments(lines[i]))) {
					// const fieldMatch = this.stripComments(lines[i]).match(/^\s*(\w+)\s+([\w.]+)/);
					const fieldMatch = this.stripComments(lines[i]).match(/^\s*(\w+)\s+((?:(?!,).)*)/i);
					if (fieldMatch) {
						logger.log("fieldMatch[1]: " + fieldMatch[1]);
						logger.log("fieldMatch[2]: " + fieldMatch[2]);
						record.fields.push({
							name: fieldMatch[1],
							type: fieldMatch[2]
						});
						structure.variables.push({
							name: recordMatch[1] + "." + fieldMatch[1],
							type: fieldMatch[2],
							scope: record.scope,
							line: lineNumber
						})
					}
					i++;
				}

				structure.records.push(record);
			}

			// Parse function calls
			const callMatch = commentlessLine.match(/^CALL\s+(\w+)/i);
			if (callMatch) {
				structure.calls.push({
					name: callMatch[1],
					line: lineNumber
				});
			}

			// parse THEN statements for indent levels
			const ifMatch = commentlessLine.match(/^\s*IF\s*.*THEN\s*$/i);
			const endMatch = commentlessLine.match(/^\s*END/i);
			if (ifMatch) {
				correctIndent++;
				// return;
			}
			const whileMatch = commentlessLine.match(/^\s*WHILE\s*/i);
			if (whileMatch) {
				correctIndent++;
			}
			if (endMatch) {
				correctIndent--;
			}

			// check if line (including comments!) is all spaces or tabs (empty)
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
			
			// detect any occurrences of unspaced commas on the line
			const unspacedCommasRegex = /,(?!\s)/g;
			let match;
			if (!commentlessLine.endsWith(",")) {
				while ((match = unspacedCommasRegex.exec(commentlessLine)) !== null) {
					structure.diagnostics.push({
						severity: DiagnosticSeverity.Hint,
						range: { start: { line: lineNumber, character: match.index},
								end: { line: lineNumber, character: match.index+1}
						},
						message: "Unspaced comma",
						source: "genero-lsp",
						code: "style/unspaced-comma",
					})
				}
			}

			// TODO...
			// check if current line count of \t(abs) is correct
			const realIndentLevel: number = this.countIndentation(line);
			// if (currentFunction && !this.ignoreLines(line) && realIndentLevel != correctIndent) {
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
		if (line.includes("RETURNING")) {
			return true;
		}
		if (line.includes("FUNCTION")) {
			return true;
		}
		if (line.trim().length === 0) {
			return true;
		}
		return false;
	}

}

