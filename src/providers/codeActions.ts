import { 
	CodeAction, 
	CodeActionParams, 
	CodeActionKind, 
	TextEdit, 
	Range, 
    Diagnostic
} from 'vscode-languageserver';

import { DocumentManager } from "../lib/documentManager";
import { Logger } from "../utils/logger";
import { FileStructure, CodeActionExtras } from "../types/genero";
import { findClosestMatch } from "../utils/levenshtein";

// logger
const logger = Logger.getInstance("hd.log");

export class CodeActionsProvider {
	constructor(private documentManager: DocumentManager) {}

	provideCodeActions(params: CodeActionParams, diagnostics: Diagnostic[]): CodeAction[] {
		logger.log("In provideCodeActions()")
		const uri: string = params.textDocument.uri;

		const structure = this.documentManager.getStructure(uri);
		if (!structure) return [];
		const curLine = params.range.start.line
		return this.getCodeActions(structure, uri, curLine, diagnostics);
	}

	getCodeActions(structure: FileStructure, uri: string, curLine: number, diagnostics: Diagnostic[]): CodeAction[] {
		let codeActions: CodeAction[] = [];
		const codeActionsExtras: CodeActionExtras[] = [];
		diagnostics = [...diagnostics, ...structure.diagnostics];
		diagnostics.forEach(diagnostic => {
			logger.log("diagnostic: " + diagnostic.code);
			// trim off "style/"		
			if ((diagnostic.code === "style/trailing-whitespace") || 
				(diagnostic.code === "style/empty-line")) {
				const action = this.createDelRangeAction(uri, diagnostic.range, diagnostic.code);
				action.diagnostics = [diagnostic]; // Link the action to the diagnostic
				const actionExtra = {line: diagnostic.range.start.line, action: action};
				// codeActions.push(action);
				codeActionsExtras.push(actionExtra);
			}
			
			if (diagnostic.code === "style/unspaced-comma") {
				// if (codeActionsExtras.find((ca => ca.line = diagnostic.range.start.line))) {
				//
				// }
				const action = this.createReplaceRangeAction(uri, diagnostic.range, diagnostic.code, ", ");
				action.diagnostics = [diagnostic];
				const actionExtra = {line: diagnostic.range.start.line, action: action};
				codeActionsExtras.push(actionExtra);
			}
			// create code action for unused var
			if (diagnostic.code === -6615) {
				const action = this.createDelRangeAction(uri, {start: {line:diagnostic.range.start.line, character:0}, end: {line:diagnostic.range.start.line+1, character: 0}}, "fglcomp/unused-var");
				action.diagnostics = [diagnostic];
				const actionExtra = {line: diagnostic.range.start.line, action: action};
				codeActionsExtras.push(actionExtra);
			}
			// grammatical error at token
			if (diagnostic.code === -6609) {
				logger.log("diagnostic.message=" + diagnostic.message);
				// find actual token
				const seenToken = this.extractSeenWord(diagnostic.message);
				if (seenToken) {
					logger.log("seenToken=" + seenToken);
					const wordList = diagnostic.message.split(":")[1];
					const closestMatch = findClosestMatch(seenToken, wordList);
					// find closest match to seen/actual token
					if (closestMatch) {
						const action = this.createReplaceRangeAction(uri, diagnostic.range, "fglcomp/token-grammar", closestMatch);
						action.diagnostics = [diagnostic];
						const actionExtra = {line: diagnostic.range.start.line, action: action};
						codeActionsExtras.push(actionExtra);
					}
				}
				// this.createExpectedActions(diagnostic);
			}
		});

		// sort by proximity to current line
		codeActions = codeActionsExtras.sort((a,b) => Math.abs(a.line - curLine) - Math.abs(b.line - curLine)).map(a => a.action);

		return codeActions;
	}
	extractSeenWord(input: string): string | null {
		const match = input.match(/found at\s+'([^']+)'/);
		return match ? match[1] : null;
	}
	createExpectedActions(diagnostic: Diagnostic) {
		
	}

	createDelRangeAction(uri: string, range: Range, code: string): CodeAction {
		return {
			title: code,
			kind: CodeActionKind.QuickFix,
			diagnostics: [], // Will be populated later
			edit: {
				changes: {
					[uri]: [
						TextEdit.del(range) // Delete the trailing whitespace
					]
				}
			}
		};
	}
	
	createReplaceRangeAction(uri: string, range: Range, code: string, newStr: string): CodeAction {
		return {
			title: code,	// TODO: cut off "style/" prefix
			kind: CodeActionKind.QuickFix,
			diagnostics: [], // Will be populated later
			edit: {
				changes: {
					[uri]: [
						TextEdit.replace(range, newStr) // replace range with specified string
					]
				}
			}
		}
	}

}
