import {
	RenameParams,
	Location,
	TextDocument,
    WorkspaceEdit,
	TextEdit,
} from "vscode-languageserver";

import { DocumentManager } from '../lib/documentManager';
import { Logger } from "../utils/logger";

// logger
const logger = Logger.getInstance("hd.log");
export class RenameProvider {
	constructor(private documentManager: DocumentManager) {}


	provideRename(doc: TextDocument, params: RenameParams, references: Location[]): WorkspaceEdit | null {
		logger.log("In provideRename");
		const structure = this.documentManager.getStructure(doc.uri);
		if (!structure) return null;
		logger.log("Found structure")
		
		let foundEdits: boolean = false;
		const edits: TextEdit[] = [];
		references.forEach((location: Location) => {
			if (!foundEdits) {
				foundEdits = true;
			}
			logger.log("Reference: " + location.range);
			edits.push(TextEdit.replace(location.range, params.newName));
		});
		let workspaceEdit: WorkspaceEdit = {
			changes: {[doc.uri]: edits}
		};
		if (!foundEdits) return null;
		logger.log("Found edits")
		return workspaceEdit;
	}
}
