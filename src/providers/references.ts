import {
	ReferenceParams,
	Location,
	Position,
	TextDocument,
} from "vscode-languageserver-protocol";

import { FileStructure, VariableDef } from '../types/genero';
import { DocumentManager } from '../lib/documentManager';
import { Logger } from "../utils/logger";
import { getWordFromLineAtPosition } from '../utils/getWordAtPosition';
import { findCurrentFunction } from "../utils/findCurrentFunction";

// logger
const logger = Logger.getInstance("hd.log");
export class ReferenceProvider {
	constructor(private documentManager: DocumentManager) {}

	provideReferences(doc: TextDocument, params: ReferenceParams): Location[] | null {
		const locations: Location[] = [];
		const position = params.position;
		const structure = this.documentManager.getStructure(doc.uri);
		if (!structure) return null;

		const lineText = doc.getText({
			start: { line: position.line, character: 0 },
			end: { line: position.line, character:  Number.MAX_SAFE_INTEGER },
		});
		const currentWord = getWordFromLineAtPosition(lineText, position.character);
		logger.log("currentWord: " + currentWord)
		if (!currentWord) return null;
		const currentFunc = findCurrentFunction(structure, position.line);
		if (!currentFunc) return null;
		
		// look for modular variables matching current word - if found search full file
		const varMatch: VariableDef | undefined = structure.variables.find(v => v.name === currentWord)
		if (!varMatch) return null;
		
		if (varMatch.scope === "modular") {
			const fileLines = doc.getText().split("\n");
			fileLines.forEach((line, lineNumber) => {
				let col = line.indexOf(varMatch.name.trim());
				while (col !== -1) {
					locations.push({
						uri: doc.uri,
						range: { 
							start: { line: lineNumber, character: col },
							end: { line: lineNumber, character: col + currentWord.length }
						}
					});
					col = line.indexOf(currentWord, col + 1);
				}
			});
		} else {
			const funcText = doc.getText({
				start: { line:currentFunc.startLine, character: 0 },
				end: { line:currentFunc.endLine, character: Number.MAX_SAFE_INTEGER }
			});
			const funcLines = funcText.split("\n");

			funcLines.forEach((line, lineNumber) => {
				let col = line.indexOf(currentWord.trim());
				while (col !== -1) {
					locations.push({
						uri: doc.uri,
						range: { 
							start: { line: currentFunc.startLine + lineNumber, character: col },
							end: { line: currentFunc.startLine + lineNumber, character: col + currentWord.length }
						}
					});
					col = line.indexOf(currentWord, col + 1);
				}
			});
		}
		return locations;
	}
}
