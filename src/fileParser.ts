interface FileStructure {
	functions: FunctionDef[];
	variables: VariableDef[];
	records: RecordDef[];
	calls: FunctionCall[];
}

interface FunctionDef {
	name: string;
	parameters: Parameter[];
	returns: ReturnValue[];
	variables: VariableDef[];
	startLine: number;
	endLine: number;
}

interface VariableDef {
	name: string;
	type: string;
	scope: 'global' | string; // Function name or 'global'
	line: number;
}

interface RecordDef {
	name: string;
	fields: RecordField[];
	line: number;
}

interface RecordField {
	name: string;
	type: string;
}

interface FunctionCall {
	name: string;
	line: number;
}

interface Parameter {
	name: string;
	type: string;
}

interface ReturnValue {
	name: string;
	type: string;
}

class FileParser {
	parse(text: string): FileStructure {
		const lines = text.split('\n');
		const structure: FileStructure = {
			functions: [],
			variables: [],
			records: [],
			calls: []
		};

		let currentFunction: FunctionDef | null = null;

		lines.forEach((line, lineNumber) => {
			line = line.trim();

			// Parse FUNCTION definitions
			const functionMatch = line.match(/^FUNCTION\s+(\w+)\s*\(([^)]*)\)/i);
			if (functionMatch) {
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
			const varMatch = line.match(/^DEFINE\s+(\w+)\s+([\w.]+)/i);
			if (varMatch) {
				const variable = {
					name: varMatch[1],
					type: varMatch[2],
					scope: currentFunction ? currentFunction.name : 'global',
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
		});

		return structure;
	}

	private parseParameters(paramString: string): Parameter[] {
		return paramString.split(',')
			.map(p => p.trim())
			.filter(p => p.length > 0)
			.map(p => {
				const [name, type] = p.split(/\s+/);
				return { name, type: type || 'unknown' };
			});
	}
}
