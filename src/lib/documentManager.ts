import { FileStructure } from '../types/genero';
import { FileParser } from './parser';
import { Logger } from "../logger";

// logger
const logger = Logger.getInstance("hd.log");

export class DocumentManager {
	private fileStructures = new Map<string, FileStructure>();
	private parser = new FileParser();

	getStructure(uri: string): FileStructure | undefined {
		logger.log("In getStructure()")
		logger.log("uri: " + uri)
		return this.fileStructures.get(uri);
	}

	updateDocument(uri: string, text: string): void {
		logger.log("In updateDocument()")
		logger.log("uri: " + uri)
		const structure = this.parser.parse(text);
		this.fileStructures.set(uri, structure);
	}
}
