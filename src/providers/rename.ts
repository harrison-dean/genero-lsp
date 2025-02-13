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
import { findCurrentFunction, findCurrentVar } from "../utils/findCurrent";

// logger
const logger = Logger.getInstance("hd.log");
export class RenameProvider {
	constructor(private documentManager: DocumentManager) {}


	provideRename(doc: TextDocument, params: RenameParams, references: Location[]): WorkspaceEdit | null {
		const structure = this.documentManager.getStructure(doc.uri);
		if (!structure) return null;

		const varMatch: VariableDef | null = findCurrentVar(doc, structure, params.position);
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
}
