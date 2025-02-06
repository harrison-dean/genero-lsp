import { 
	CompletionItem,
	CompletionItemKind,
	MarkupKind,
} from 'vscode-languageserver';

import { GeneroKeyword, FileStructure } from '../types/genero';
import { DocumentManager } from '../lib/documentManager';
import { Logger } from "../logger";

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

	provideCompletions(uri: string): CompletionItem[] {
		logger.log("In provideCompletions()")
		logger.log(uri)
		const structure = this.documentManager.getStructure(uri);
		if (!structure) return [];

		

		return [
			...this.getKeywordCompletions(uri),
			...this.getFunctionCompletions(structure),
			...this.getVariableCompletions(structure)
		];
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

	private getFunctionCompletions(structure: FileStructure): CompletionItem[] {
		return structure.functions.map(fn => ({
			label: fn.name,
			kind: CompletionItemKind.Function,
			detail: `Function: ${fn.name}`,
			documentation: {
				kind: MarkupKind.Markdown,
				value: [
					`**Parameters:**`,
					...fn.parameters.map(p => `- \`${p.name}\`: ${p.type}`),
					`**Returns:** ${fn.returns[0]?.type || 'void'}`
				].join('\n')
			}
		}));
	}

	private getVariableCompletions(structure: FileStructure): CompletionItem[] {
	// Combine global and function-scoped variables using reduce
	const allVars = structure.functions.reduce<VariableDef[]>(
		(acc, fn) => acc.concat(fn.variables),
		[...structure.variables]
	);

	return allVars.map(v => ({
		label: v.name,
		kind: CompletionItemKind.Variable,
		detail: `Variable: ${v.name} (${v.type})`,
		documentation: {
		kind: MarkupKind.Markdown,
		value: `**Scope:** ${v.scope}`
		}
	}));
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
}
