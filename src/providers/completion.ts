import { 
	CompletionItem,
	CompletionItemKind,
	CompletionParams,
	MarkupKind,
	Position,
	TextDocument,
} from 'vscode-languageserver';

import { GeneroKeyword, FileStructure } from '../types/genero';
import { DocumentManager } from '../lib/documentManager';
import { Logger } from "../utils/logger";
import { findCurrentFunction } from "../utils/findCurrentFunction";

import fourGlKeywords from '../resources/4GLKeywords.json';
import perKeywordsData from "../resources/PERKeywords.json";
const perKeywords = perKeywordsData.keywords; // Extract nested array

// logger
const logger = Logger.getInstance("hd.log");

/////////////////
// completions //
/////////////////

export class CompletionProvider {
	constructor(private documentManager: DocumentManager) {}

	provideCompletions(doc: TextDocument, params: CompletionParams): CompletionItem[] {
		logger.log("In provideCompletions()")
		const uri: string = params.textDocument.uri
		const structure = this.documentManager.getStructure(uri);
		if (!structure) return [];

		const contextCompletions: CompletionItem[] = this.getContextCompletions(doc, structure, params);

		// return [
		// 	...this.getKeywordCompletions(uri),
		// 	...this.getFunctionCompletions(structure),
		// 	...this.getVariableCompletions(structure)
		// ];
		return contextCompletions;
	}

	private getKeywordCompletions(uri: string): CompletionItem[] {
		// Implementation...
		logger.log("In getKeywordCompletions()")
		logger.log(uri)
		const isPerFile = uri.endsWith('.per');

		// Get the appropriate keyword list with type safety
		const activeKeywords: GeneroKeyword[] = isPerFile ? perKeywords : fourGlKeywords;

		// get keyword autocompletions
		const keywordItems = activeKeywords.map((keyword: GeneroKeyword) => ({
			label: keyword.name,
			kind: CompletionItemKind.Keyword,
			detail: keyword.type || undefined,
			documentation: keyword.description || undefined
		}));

		return keywordItems;
	}

	private getFunctionCompletions(structure: FileStructure, position: Position): CompletionItem[] {
		return structure.functions.map(fn => ({
			label: fn.name,
			kind: CompletionItemKind.Function,
			detail: `Function: ${fn.name}`,
			documentation: {
				kind: MarkupKind.Markdown,
				value: [
					`**Parameters:**`,
					...fn.parameters.map(p => `- \`${p.name}\`: ${p.type}`),
					// `**Returns:** ${fn.returns[0]?.type || 'void'}`
					"**Returns:**",
					...fn.returns.map(r => `- \`${r.name}\`: ${r.type}`),
				].join('\n')
			}
		}));
	}

	private getVariableCompletions(structure: FileStructure, position: Position): CompletionItem[] {
		// Combine global and function-scoped variables using reduce
		// const allVars = structure.functions.reduce<VariableDef[]>(
		// 	(acc, fn) => acc.concat(fn.variables),
		// 	[...structure.variables]
		// );
		//
		// return allVars.map(v => ({
		// 	label: v.name,
		// 	kind: CompletionItemKind.Variable,
		// 	detail: `Variable: ${v.name} (${v.type})`,
		// 	documentation: {
		// 	kind: MarkupKind.Markdown,
		// 	value: `**Scope:** ${v.scope}`
		// 	}
		// }));
		const curFunc: string | null = findCurrentFunction(structure, position.line);
		logger.log("curFunc: " + curFunc);
		return structure.variables.filter(variable => variable.scope === "modular" || variable.scope === curFunc).map(fn => ({
			label: fn.name,
			kind: CompletionItemKind.Variable,
			detail: `Variable: ${fn.name}`,
			documentation: {
				kind: MarkupKind.Markdown,
				value: `**Type:** ${fn.type}\n**Scope:** ${fn.scope}`
			}
		}))
	}

	// private getRecordFieldCompletions(linePrefix: string, uri: string): CompletionItem[] {
	// const structure = fileStructures.get(uri);
	// if (!structure) return [];
	//
	// // Extract record name before the dot
	// const recordName = linePrefix.split('.').slice(-2, -1)[0].trim();
	// const record = structure.records.find(r => r.name === recordName);
	//
	// if (!record) return [];
	//
	// return record.fields.map(field => ({
	// 	label: field.name,
	// 	kind: CompletionItemKind.Field,
	// 	detail: `Field: ${field.name} (${field.type})`,
	// 	documentation: {
	// 	kind: MarkupKind.Markdown,
	// 	value: `**Record:** ${record.name}`
	// 	}
	// }));
	// }

	getContextCompletions(doc: TextDocument, structure: FileStructure, params: CompletionParams): CompletionItem[] {
	let completions: CompletionItem[] = []
	const position = params.position;
	// Retrieve the text of the current line
	const lineText = doc.getText({
		start: { line: position.line, character: 0 },
		end: { line: position.line, character:  Number.MAX_SAFE_INTEGER },
	});
	logger.log("lineText: " + lineText);


	const keywords = this.getKeywordCompletions(doc.uri);
	const functions = this.getFunctionCompletions(structure, position);
	const variables = this.getVariableCompletions(structure, position);

	// when to suggest keywords (always?)
	completions = [...completions, ...keywords]

	// when to suggest function names
	if (lineText.includes("CALL") || lineText.includes("=")) {
		completions = [...completions, ...functions]
	}

	// when to suggest variables
	if (lineText.includes("LET") || lineText.includes("=") || lineText.includes("CALL") || lineText.includes("RETURNING")) {
		completions = [...completions, ...variables]
		
	}
	return completions;
	}
}
