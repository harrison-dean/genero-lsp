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
		logger.log("params uri:" + params.textDocument.uri)
		logger.log("params line:" + params.position.line)
		logger.log("params char:" + params.position.character)
		logger.log("params context:" + params.context.includeDeclaration)
		const locations: Location[] = [];
		const structure = this.documentManager.getStructure(doc.uri);
		if (!structure) return null;

		const varMatch: VariableDef | null = findCurrentVar(doc, structure, params.position);
		if (varMatch) {
			logger.log("varMatch name:" + varMatch.name);
		}
		// if (!varMatch) return null;
	
		const currentFunc: FunctionDef | null = findCurrentFunction(structure, params.position.line)
		if (currentFunc) {
			logger.log("currentFunc: " + currentFunc.name);
		}

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
		
		locations.forEach((location: Location) => {
			logger.log("Location start: " + location.range.start.line + " " + location.range.start.character)
			logger.log("Location end: " + location.range.end.line + " " + location.range.end.character)
		})

		return locations;
	}
}
