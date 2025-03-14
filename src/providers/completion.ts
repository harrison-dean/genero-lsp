import { 
	CompletionItem,
	CompletionItemKind,
	CompletionParams,
	MarkupKind,
	Position,
	TextDocument,
} from 'vscode-languageserver';

import { GeneroKeyword, FileStructure, FunctionDef } from '../types/genero';
import { DocumentManager } from '../lib/documentManager';
import { Logger } from "../utils/logger";
import { findCurrentFunction } from "../utils/findCurrent";

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

		const snippetCompletions: CompletionItem[] = this.getSnippetCompletions();

		return [...contextCompletions, ...snippetCompletions];
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
			documentation: {
				kind: MarkupKind.Markdown,
				value: [
					`\`Parameters:\``,
					...fn.parameters.map(p => `- \`${p.name}\`: ${p.type}`),
					"**Returns:**",
					...fn.returns.map(r => `- \`${r.name}\`: ${r.type}`),
				].join('\n')
			}
		}));
	}

	private getVariableCompletions(structure: FileStructure, position: Position): CompletionItem[] {
		const curFunc: FunctionDef | null = findCurrentFunction(structure, position.line);
		logger.log("curFunc: " + curFunc);

		return structure.variables.filter(variable => variable.scope === "modular" || curFunc && variable.scope === curFunc.name).map(fn => ({
			label: fn.name,
			kind: fn.name.includes(".") ? CompletionItemKind.Field : CompletionItemKind.Variable,
			detail: `Type  : ${fn.type}\nScope : ${fn.scope}`,
		}))
	}

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
		const functions = this.getFunctionCompletions(structure);
		const variables = this.getVariableCompletions(structure, position);

		// when to suggest keywords (always?)
		completions = [...completions, ...keywords]

		// when to suggest function names
		if (lineText.includes("CALL") || 
			lineText.includes("=")
		){
			completions = [...completions, ...functions]
		}

		// when to suggest variables
		if (lineText.includes("LET") || 
			lineText.includes("=") || 
			lineText.includes("CALL") || 
			lineText.includes("RETURN") ||
			lineText.includes("DISPLAY") ||
			lineText.includes("FROM") ||
			lineText.includes("TO") || 
			lineText.includes("INPUT") || 
			lineText.includes("FOR") ||
			lineText.includes("IF") ||
			lineText.includes("CASE") ||
			lineText.includes("INTO") ||
			lineText.includes("FUNCTION") ||
			lineText.includes("REPORT") ||
			lineText.includes("RUN")
			
		){
			completions = [...completions, ...variables]
			
		}
		return completions;
	}

	getSnippetCompletions(): CompletionItem[] {
		const ifSnippet: CompletionItem = {
			label: "if-statement",
			kind: CompletionItemKind.Snippet,
			detail: "Basic if statement",
			insertText: "IF  THEN\n\t# block\nEND IF"
		}
		return [ifSnippet]
	}
}
