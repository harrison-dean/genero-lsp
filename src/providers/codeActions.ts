import { 
	CodeAction, 
	CodeActionKind, 
	TextEdit, 
	Range 
} from 'vscode-languageserver';

import { DocumentManager } from "../lib/documentManager";
import { Logger } from "../logger";

// logger
const logger = Logger.getInstance("hd.log");

export class CodeActionsProvider {
	constructor(private documentManager: DocumentManager) {}

}
export function createRemoveTrailingWhitespaceAction(
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
