import { 
	CodeAction, 
	CodeActionParams, 
	CodeActionKind, 
	TextEdit, 
	Range 
} from 'vscode-languageserver';

import { DocumentManager } from "../lib/documentManager";
import { Logger } from "../utils/logger";
import { FileStructure, CodeActionExtras } from "../types/genero";

// logger
const logger = Logger.getInstance("hd.log");

export class CodeActionsProvider {
	constructor(private documentManager: DocumentManager) {}

	provideCodeActions(params: CodeActionParams): CodeAction[] {
		logger.log("In provideCodeActions()")
		const uri: string = params.textDocument.uri;

		const structure = this.documentManager.getStructure(uri);
		if (!structure) return [];
		const curLine = params.range.start.line
		return this.getCodeActions(structure, uri, curLine);
	}

	getCodeActions(structure: FileStructure, uri: string, curLine: number): CodeAction[] {
		let codeActions: CodeAction[] = [];
		const codeActionsExtras: CodeActionExtras[] = [];
		const diagnostics = structure.diagnostics;
		diagnostics.forEach(diagnostic => {
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
				const action = this.createReplaceRangeAction(uri, diagnostic.range, diagnostic.code, ", ");
				action.diagnostics = [diagnostic];
				const actionExtra = {line: diagnostic.range.start.line, action: action};
				codeActionsExtras.push(actionExtra);
			}
		});

	// sort by proximity to current line
	codeActions = codeActionsExtras.sort((a,b) => Math.abs(a.line - curLine) - Math.abs(b.line - curLine)).map(a => a.action);

	return codeActions;
	}

	createDelRangeAction(uri: string, range: Range, code: string): CodeAction {
		return {
			title: code,	// TODO: cut off "style/" prefix
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
