import {
	DefinitionParams,
	Location,
	TextDocument,
} from "vscode-languageserver-protocol";

import { FunctionDef, FileStructure, VariableDef } from '../types/genero';
import { DocumentManager } from '../lib/documentManager';
import { Logger } from "../utils/logger";
import { getWordFromLineAtPosition } from '../utils/getWordAtPosition';
import { findCurrentFunction } from "../utils/findCurrent";

// logger
const logger = Logger.getInstance("hd.log");

export class DefinitionProvider {
	constructor(private documentManager: DocumentManager) {}

	provideDefinition(doc: TextDocument, params: DefinitionParams) : Location | null {
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
		

		// look for local/modular variables matching current word - if found search full file
		const varMatch: VariableDef | undefined = structure.variables.find(v => v.name === currentWord && (v.scope === "modular" || v.scope === currentFunc.name));
		if (varMatch) {
			return {
				uri: doc.uri,
				range: {
					start: {line: varMatch.line, character: 0},
					end: {line: varMatch.line, character: 0}
				}
			}
		}
		
		// go to function def
		if (!varMatch) {
			const funcMatch: FunctionDef | undefined = structure.functions.find(f => f.name === currentWord);
			if (funcMatch) return {
				uri: doc.uri,
				range: {
					start: {line: funcMatch.startLine, character: 0},
					end: {line: funcMatch.startLine, character: 0}
				}
			}
		}
		
		return null
	}
}
