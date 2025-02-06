import { 
	CodeAction, 
	CodeActionKind, 
	TextEdit, 
	Range 
} from 'vscode-languageserver';

import { DocumentManager } from "../lib/documentManager";
import { Logger } from "../logger";
import { FileStructure } from "../types/genero";

// logger
const logger = Logger.getInstance("hd.log");

export class CodeActionsProvider {
	constructor(private documentManager: DocumentManager) {}

	provideCodeActions(uri: string): CodeAction[] {
		logger.log("In provideCodeActions()")
		logger.log(uri)

		const structure = this.documentManager.getStructure(uri);
		if (!structure) return [];

		return this.getCodeActions(structure, uri);
	}

	getCodeActions(structure: FileStructure, uri: string): CodeAction[] {
		const codeActions: CodeAction[] = [];
		const diagnostics = structure.diagnostics;
		diagnostics.forEach(diagnostic => {
			if (diagnostic.code === "style/trailing-whitespace") {
				const action = this.createRemoveTrailingWhitespaceAction(
					diagnostic.range,
					uri
				);
				action.diagnostics = [diagnostic]; // Link the action to the diagnostic
				codeActions.push(action);
			}
		});

	return codeActions;
	}

	createRemoveTrailingWhitespaceAction(
	range: Range,
	documentUri: string
	): CodeAction {
	return {
		title: "Remove trailing whitespace",
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
