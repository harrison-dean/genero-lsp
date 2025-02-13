import {
	ReferenceParams,
	Location,
	TextDocument,
} from "vscode-languageserver-protocol";

import { VariableDef, FunctionDef } from '../types/genero';
import { DocumentManager } from '../lib/documentManager';
import { Logger } from "../utils/logger";
import { findCurrentFunction, findCurrentVar } from "../utils/findCurrent";

// logger
const logger = Logger.getInstance("hd.log");
export class ReferenceProvider {
	constructor(private documentManager: DocumentManager) {}

	provideReferences(doc: TextDocument, params: ReferenceParams): Location[] | null {
		logger.log("In provideReferences()")
		const locations: Location[] = [];
		const structure = this.documentManager.getStructure(doc.uri);
		if (!structure) return null;

		const varMatch: VariableDef | null = findCurrentVar(doc, structure, params.position);
		// if (!varMatch) return null;
	
		const currentFunc: FunctionDef | null = findCurrentFunction(structure, params.position.line)

		let offset: number;
		let lines = null;
		if (varMatch && varMatch.scope === "modular") {
			offset = 0;
			lines = doc.getText().split("\n");
		} else if (currentFunc){
			offset = currentFunc.startLine;
			lines = doc.getText({
				start: { line:currentFunc.startLine, character: 0 },
				end: { line:currentFunc.endLine, character: Number.MAX_SAFE_INTEGER }
			}).split("\n");
		}
		
		if (lines && varMatch) {
			lines.forEach((line, lineNumber) => {
				let col = line.indexOf(varMatch.name.trim());
				while (col !== -1) {
					locations.push({
						uri: doc.uri,
						range: { 
							start: { line: offset + lineNumber, character: col },
							end: { line: offset + lineNumber, character: col + varMatch.name.length }
						}
					});
					col = line.indexOf(varMatch.name, col + 1);
				}
			})
		}
		return locations;
	}
}
