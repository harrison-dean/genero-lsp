import {
	RenameParams,
	Location,
	TextDocument,
    WorkspaceEdit,
	TextEdit,
} from "vscode-languageserver";

import { FileStructure, VariableDef } from '../types/genero';
import { DocumentManager } from '../lib/documentManager';
import { Logger } from "../utils/logger";
import { getWordFromLineAtPosition } from '../utils/getWordAtPosition';
import { findCurrentFunction } from "../utils/findCurrentFunction";

// logger
const logger = Logger.getInstance("hd.log");
export class RenameProvider {
	constructor(private documentManager: DocumentManager) {}


	provideRename(doc: TextDocument, params: RenameParams, references: Location[]): WorkspaceEdit | null {
// TODO : DRY +
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
		
		const edits: TextEdit[] = [];

		references.forEach((location: Location) => {
			edits.push(TextEdit.replace(location.range, params.newName));
		});
		let workspaceEdit: WorkspaceEdit = {
			changes: {[doc.uri]: edits}
		};
		return workspaceEdit;
	}
// TODO : DRY -
}
