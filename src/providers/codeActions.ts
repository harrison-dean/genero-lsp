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
				const action = this.createDelRangeAction(diagnostic.range, uri, diagnostic.code);
				action.diagnostics = [diagnostic]; // Link the action to the diagnostic
				const actionExtra = {line: diagnostic.range.start.line, action: action};
				// codeActions.push(action);
				codeActionsExtras.push(actionExtra);
			}
		});

	// sort by line
	codeActions = codeActionsExtras.sort((a,b) => Math.abs(a.line - curLine) - Math.abs(b.line - curLine)).map(a => a.action);

	return codeActions;
	}

	createDelRangeAction(range: Range, documentUri: string, code: string): CodeAction {
		return {
			title: code,	// TODO: cut off "style/" prefix
			kind: CodeActionKind.QuickFix,
			diagnostics: [], // Will be populated later
			edit: {
				changes: {
					[documentUri]: [
						TextEdit.del(range) // Delete the trailing whitespace
					]
				}
			}
		};
	}
}
