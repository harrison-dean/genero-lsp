import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	InitializeResult,
	TextDocumentSyncKind,
	CompletionItem,
	CompletionItemKind,
	Hover,
	Range,
	Diagnostic as LSPDiagnostic,
	DiagnosticSeverity,
	TextEdit,
	TextDocumentPositionParams,
	Location,
} from 'vscode-languageserver/node';

import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as path from 'path';

import fourGlKeywords from './resources/4GLKeywords.json';
import perKeywordsData from "./resources/PERKeywords.json";
const perKeywords = perKeywordsData.keywords; // Extract nested array

import types from './resources/built-in_dataTypes.4GLPackage.json';
import packages from './resources/built-in_ui.4GLPackage.json';
import { compileSchema } from './schemaLoader';
import { compileFile } from './compileGeneroFile';
import { searchFunctionDefinition } from "./findFunctionDefinition";
import { Logger } from "./logger";

// interfaces //
///////////////
interface GeneroKeyword {
	name: string;
	type?: string;
	description?: string;
	documentation?: string;
}

// 4GL keywords type (flat array)
type FourGlKeywords = GeneroKeyword[];

// PER keywords type (object with nested array)
interface PerKeywordsData {
	keywords: GeneroKeyword[];
}

type KeywordCollection = GeneroKeyword[] | { keywords: GeneroKeyword[] };

// Define the type for the packages object
interface PackageInfo {
	name: string;
	type: string;
	description?: string;
	documentation?: string;
	classes?: ClassInfo[];
}

interface ClassInfo {
	name: string;
	description?: string;
	documentation?: string;
	minimumLanguageVersion?: string;
	maximumLanguageVersion?: string;
	classMethods?: MethodInfo[];
}

interface MethodInfo {
	name: string;
	description?: string;
	documentation?: string;
	minimumLanguageVersion?: string;
	maximumLanguageVersion?: string;
	parameters?: ParameterInfo[];
	returns?: ReturnInfo[];
}

interface ParameterInfo {
	name: string;
	type: string;
	description?: string;
}

interface ReturnInfo {
	type: string;
	description?: string;
}

interface Diagnostic {
	filePath: string;
	startLine: number;
	startColumn: number;
	endLine: number;
	endColumn: number;
	severity: 'warning' | 'error';
	code: string;
	message: string;
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// track document URIs
const openDocumentUris = new Set<string>();

// logger
const logger = Logger.getInstance("hd.log");

// Cache function names per document URI
const functionCache = new Map<string, string[]>();

// document methods //
/////////////////////
// Listen for document opens
documents.onDidOpen(event => {
	const fileUri = event.document.uri;
	openDocumentUris.add(fileUri);
	loadDiagnostics(fileUri);
	const doc = documents.get(fileUri);
	if (doc) functionCache.set(fileUri, parseFunctions(doc));
});

documents.onDidChangeContent(async(change) => {
	// validateTextDocument(change.document);
	// loadDiagnostics(change.document.uri);
});

documents.onDidSave(async (change) => {
	const fileUri = change.document.uri;
	loadDiagnostics(fileUri);
	const doc = documents.get(change.document.uri);
	if (doc) functionCache.set(fileUri, parseFunctions(doc));
});

// Listen for document closes
documents.onDidClose(event => {
	openDocumentUris.delete(event.document.uri);
});

// connection methods //
///////////////////////
connection.onInitialize((params: InitializeParams): InitializeResult => {
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				resolveProvider: true
			},
			hoverProvider: true,
			documentFormattingProvider: true,
		definitionProvider: true,
		}
	};
});

connection.onCompletion((textDocumentPosition): CompletionItem[] => {
	const uri = textDocumentPosition.textDocument.uri;
	const isPerFile = uri.endsWith('.per');

	// Get the appropriate keyword list with type safety
	const activeKeywords: GeneroKeyword[] = isPerFile ? perKeywords : fourGlKeywords;

	
	const keywordItems = activeKeywords.map((keyword: GeneroKeyword) => ({
		label: keyword.name,
		kind: CompletionItemKind.Keyword,
		detail: keyword.type || undefined,
	documentation: keyword.description || undefined
	}));
	
	const functions = functionCache.get(uri) || [];
	const functionItems = functions.map(func => ({
		label: func,
		kind: CompletionItemKind.Function,
		detail: 'Local function',
	}));

	return [
	...keywordItems,
	...functionItems
	];
});


connection.onHover(async (params: TextDocumentPositionParams): Promise<Hover | null> => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return null;

	const text = document.getText();
	const offset = document.offsetAt(params.position);
	const functionPattern = /\b\w+\s*\([^)]*\)/g;
	const wordRange = getWordRangeAtPosition(text, offset, functionPattern);
	logger.log("wordRange = " + wordRange)

	if (wordRange) {
		const functionCall = text.slice(wordRange.start, wordRange.end);
		const functionName = functionCall.split('(')[0].trim();
		let functionInfo = getFunctionInfoFromFile(text, functionName);
		if (!functionInfo) {
			const searchResult = await searchFunctionDefinition(functionName);
			if (searchResult) {
				functionInfo = parseFunctionDefinition(searchResult.filePath, searchResult.line);
			}
		}
		if (functionInfo) {
			return {
				contents: {
					kind: 'markdown',
					value: functionInfo,
				},
			};
		}
	} else {
		const word = getWordAtPosition(document, params.position);
		if (!word) {
			return null;
		}

		const typeDefinition = findTypeDefinition(document, params.position, word);
		if (!typeDefinition) {
			return null;
			}

		return {
		contents: {
			kind: 'plaintext',
			value: `Type: ${typeDefinition}`,
			},
			};
	}

	return null;
});

connection.onDocumentFormatting((params): TextEdit[] => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return [];

	const text = document.getText();
	const formattedText = formatGeneroCode(text);
	return [
		TextEdit.replace(
			{
				start: { line: 0, character: 0 },
				end: { line: document.lineCount, character: 0 }
			},
			formattedText
		)
	];
});


// misc funcs //
////////////////

function parseFunctions(document: TextDocument): string[] {
	// Regex to match Genero function definitions (case-insensitive)
	const FUNCTION_REGEX = /^\s*FUNCTION\s+([a-zA-Z_][\w.]*)\s*\(/gim;
	const text = document.getText();
	const functions: string[] = [];
	let match: RegExpExecArray | null;

	while ((match = FUNCTION_REGEX.exec(text)) !== null) {
		const funcName = match[1].trim();
		if (funcName) functions.push(funcName);
	}

	return functions;
}

function parseDiagnostics(output: string): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const lines = output.split('\n');
	const regex = /^(.*):(\d+):(\d+):(\d+):(\d+):(warning|error):\((-\d+)\) (.*)$/;

	for (const line of lines) {
		const match = line.match(regex);
		if (match) {
			diagnostics.push({
				filePath: match[1],
				startLine: parseInt(match[2], 10),
				startColumn: parseInt(match[3], 10),
				endLine: parseInt(match[4], 10),
				endColumn: parseInt(match[5], 10),
				severity: match[6] as 'warning' | 'error',
				code: match[7],
				message: match[8],
			});
		}
	}

	return diagnostics;
}


async function loadDiagnostics(fileUri: string) {
	try {
		const output = await compileFile(fileUri);
		const diagnostics = parseDiagnostics(output);

		const lspDiagnostics: LSPDiagnostic[] = diagnostics.map(diag => ({
			range: {
				start: { line: diag.startLine - 1, character: diag.startColumn - 1 },
				end: { line: diag.endLine - 1, character: diag.endColumn }
			},
			severity: diag.severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
			code: diag.code,
			source: 'fglcomp',
			message: diag.message,
		}));

		connection.sendDiagnostics({ uri: fileUri, diagnostics: lspDiagnostics });
	} catch (error) {
		connection.console.error(`Error compiling file: ${error}`);
	}
}



function getWordRangeAtPosition(text: string, offset: number, pattern: RegExp) {
	let match;
	while ((match = pattern.exec(text)) !== null) {
		if (match.index <= offset && pattern.lastIndex >= offset) {
			return { start: match.index, end: pattern.lastIndex };
		}
	}
	return null;
}

function formatGeneroCode(text: string): string {
	// Implement your formatting logic here
	return text;
}


function parseFunctionDefinition(filePath: string, line: number): string | null {
	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split('\n');
	const functionLines = [];
	let inFunction = false;

	for (let i = line - 1; i < lines.length; i++) {
		const line = lines[i];
	// logger.log("line: " + line)
		functionLines.push(line);
	const endFuncPattern = /^END\s+FUNCTION\s*/
		if (endFuncPattern.exec(line)) {
			inFunction = true;
			break;
		}
	}

	if (inFunction) {
		const functionText = functionLines.join('\n');
		const functionDefPattern = /FUNCTION\s+(\w+)\s*\(([^)]*)\)/;
		const match = functionDefPattern.exec(functionText);
		if (match) {
			const params = match[2].split(',').map(param => param.trim());
			const paramTypes = parseParamTypes(functionText);
			const paramInfo = params.map(param => `${param}: ${paramTypes[param] || 'unknown'}`).join(', ');
		const fileName = path.basename(filePath);
			return `**File:** ${fileName}\n**Function:** ${match[1]}\n**Parameters:** ${paramInfo}`;
		}
	}

	return null;
}

function parseParamTypes(functionText: string): { [param: string]: string } {
	const paramTypes: { [param: string]: string } = {};
	const definePattern = /DEFINE\s+(\w+)\s+(.*)/g;
	// const definePattern = /DEFINE\s+(\w+)\s+((?:.(?!\s*#))*.+?)\s*(?:#.*)?$/gim;
	let match;
	while ((match = definePattern.exec(functionText)) !== null) {
		paramTypes[match[1]] = match[2];
	}
	return paramTypes;
}


function getFunctionInfoFromFile(text: string, functionName: string): string | null {
	const functionDefPattern = new RegExp(`FUNCTION\\s+${functionName}\\s*\\(([^)]*)\\)`, 'g');
	const match = functionDefPattern.exec(text);
	if (match) {
		const params = match[1].split(',').map(param => param.trim());
		return `**Function:** ${functionName}\n\n**Parameters:** ${params.join(', ')}`;
	}
	return null;
}

function getWordAtPosition(document: TextDocument, position: Position): string | null {
	const line = document.getText({
		start: { line: position.line, character: 0 },
		end: { line: position.line, character: Number.MAX_SAFE_INTEGER },
	});

	// Split the line into words, considering non-alphanumeric characters as delimiters
	const words = line.split(/[^a-zA-Z0-9_]+/);
	let word = null;

	// Find the word under the cursor
	words.forEach((w, index) => {
		const start = line.indexOf(w);
		const end = start + w.length;
		if (position.character >= start && position.character <= end) {
			word = w;
		}
	});

	return word || null;
}
function findTypeDefinition(document: TextDocument, position: Position, word: string): string | null {
	for (let line = position.line; line >= 0; line--) {
		const text = document.getText({
			start: { line, character: 0 },
			end: { line, character: Number.MAX_SAFE_INTEGER },
		});

		// Remove comments from the line
		const codeWithoutComments = text.replace(/#.*$/, '').trim();

		const match = codeWithoutComments.match(new RegExp(`DEFINE\\s+${word}\\s+(\\w+|LIKE\\s+\\w+\\.\\w+)\\s*$`, 'i'));
		if (match) {
			return match[1];
		}
	}

	return null;
}

documents.listen(connection);
connection.listen();
