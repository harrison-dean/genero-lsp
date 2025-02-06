import { 
	CodeAction, 
	CodeActionKind, 
	TextEdit, 
	Range 
} from 'vscode-languageserver';

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
