import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position } from 'vscode-languageserver';

export function getWordFromLineAtPosition(line: string, column: number): string | undefined {
	// Define what characters are considered part of a word
	const isWordChar = (ch: string) => /\w/.test(ch);
	let start = column;
	let end = column;

	while (start > 0 && isWordChar(line.charAt(start - 1))) {
		start--;
	}

	while (end < line.length && isWordChar(line.charAt(end))) {
		end++;
	}

	return start < end ? line.substring(start, end) : undefined;

}
export function getWordAtPosition(document: TextDocument, position: Position): string | undefined {
	// Get the entire line text
	const lineText = document.getText({
		start: { line: position.line, character: 0 },
		end: { line: position.line, character: Number.MAX_SAFE_INTEGER }
	});

	// Define what characters are considered part of a word
	const isWordChar = (ch: string) => /\w/.test(ch);

	let start = position.character;
	let end = position.character;

	// Scan backwards to find the start of the word
	while (start > 0 && isWordChar(lineText.charAt(start - 1))) {
		start--;
	}
	// Scan forwards to find the end of the word
	while (end < lineText.length && isWordChar(lineText.charAt(end))) {
		end++;
	}

	// If no word is found, return undefined
	return start < end ? lineText.substring(start, end) : undefined;
}

