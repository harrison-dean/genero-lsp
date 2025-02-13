import {
	Position,
	TextDocument,
} from "vscode-languageserver";

import { 
	FileStructure, 
	FunctionDef, 
	VariableDef } from '../types/genero';
import { getWordFromLineAtPosition } from './getWordAtPosition';

import { Logger } from "./logger";
// logger
const logger = Logger.getInstance("hd.log");

export function findCurrentFunction(structure: FileStructure, lineNumber: number) : FunctionDef | null {
	// Ensure the functions are sorted by startLine
	structure.functions.sort((a, b) => a.startLine - b.startLine);

	// Find the function that includes the lineNumber
	const curFunc: FunctionDef | undefined = structure.functions.find(func => func.startLine <= lineNumber && func.endLine >= lineNumber);
	if (!curFunc) return null;

	return curFunc;
}

export function findCurrentVar(doc: TextDocument, structure: FileStructure, position: Position) {
	const lineText = doc.getText({
		start: { line: position.line, character: 0 },
		end: { line: position.line, character:  Number.MAX_SAFE_INTEGER },
	});

	const currentWord = getWordFromLineAtPosition(lineText, position.character);
	if (!currentWord) return null;
	logger.log("currentVar: " + currentWord)
	
	// look for modular variables matching current word - if found search full file
	const varMatch: VariableDef | undefined = structure.variables.find(v => v.name === currentWord)
	if (!varMatch) return null;

	return varMatch;
}
