import { FileStructure, FunctionDef } from '../types/genero';
import { Logger } from "./logger";
// logger
const logger = Logger.getInstance("hd.log");

export function findCurrentFunction(structure: FileStructure, lineNumber: number) {
	// Ensure the functions are sorted by startLine
	structure.functions.sort((a, b) => a.startLine - b.startLine);

	// Find the function that includes the lineNumber
	const curFunc: FunctionDef | undefined = structure.functions.find(func => func.startLine <= lineNumber && func.endLine >= lineNumber);
	if (!curFunc) return null;

	return curFunc.name;
}
