
import {
	TextDocumentPositionParams,
	TextDocument,
	Position,
	Hover,
	MarkupKind,
} from 'vscode-languageserver/node';
import { DocumentManager } from "../lib/documentManager";
import { Logger } from "../utils/logger";
import { FileStructure, VariableDef } from "../types/genero";
import { findCurrentFunction } from "../utils/findCurrentFunction";

// logger
const logger = Logger.getInstance("hd.log");

export class HoverProvider {
	constructor(private documentManager: DocumentManager) {}

	async provideHover(doc: TextDocument, params: TextDocumentPositionParams) : Promise<Hover | null> {
		const struct: FileStructure | undefined = this.documentManager.getStructure(params.textDocument.uri);
		if (!struct) return null;
		const word = this.getCurrentWord(doc, params.position);
		// return this.getHover(word);
		logger.log("word: " + word);
		if (!word) return null;
	
		const hoverContent = this.findDefinitionInFileStructure(word, struct, params.position);
		if (!hoverContent) return null;
		// Return the hover content
		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: hoverContent.content
			}
		}
	}
	
	getCurrentWord(doc: TextDocument, position: Position) {
		const text = doc.getText();
		const offset = doc.offsetAt(position);

		// Regex to match word boundaries
		const wordRegex = /[\w.]+/g;
		let match: RegExpExecArray | null;

		while ((match = wordRegex.exec(text)) !== null) {
			const start = match.index;
			const end = start + match[0].length;

			if (offset >= start && offset <= end) {
				return match[0]; // Return the matched word
			}
		}
		return null;
	}
	
	findDefinitionInFileStructure(word: string, structure: FileStructure, position: Position) {
		if (!structure) return null;
		const functionMatch = structure.functions.find(fn => fn.name === word);
		const curFunc: string | null = findCurrentFunction(structure, position.line + 1);

		if (functionMatch) {
			return {
			content: `**Function**: ${functionMatch.name}\n\n` +
					`**Parameters**: \n${functionMatch.parameters.map(p => `- \`${p.name}\`: ${p.type}`).join('\n')}\n` +
					`**Returns**: \n${functionMatch.returns.map(r => `- \`${r.name}\`: ${r.type}`).join('\n')}`
			};
		}

		// Check variables (global + function-scoped)
		const allVariables = structure.functions.reduce<VariableDef[]>(
			(acc, fn) => acc.concat(fn.variables),
			[...structure.variables] // Start with global variables
		);
		
		// only search variables in this function or modular
		const variableMatch = allVariables.find(v => v.name === word && (v.scope === curFunc || v.scope === "modular"));
		if (variableMatch) {
			let scopeStr: string = `**Scope**: ${variableMatch.scope}`
			if (variableMatch.scope === "modular") {
				scopeStr = "";
			}
			return {
			content: `**Type**: ${variableMatch.type}\n` +
					scopeStr
			};
		}

		// Check records
		const recordMatch = structure.records.find(r => r.name === word);
		if (recordMatch) {
			return {
			content: `**Record**: ${recordMatch.name}\n` +
					`**Fields**:\n` +
					recordMatch.fields.map(f => `- ${f.name}: ${f.type}`).join('\n')
			};
		}

		return null; // No match found
	}
}
