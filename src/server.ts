import {
	Hover,
	HoverParams,
	TextDocuments, 
	createConnection, 
	ProposedFeatures,
	TextDocumentSyncKind,
	CompletionItem,
	CompletionParams,
	InitializeResult,
	InitializeParams,
	Diagnostic,
	ReferenceParams,
	ReferenceContext,
	CodeActionParams,
} from 'vscode-languageserver/node';

import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import { DocumentManager } from './lib/documentManager';
import { CompletionProvider } from './providers/completion';
import { DiagnosticsProvider } from './providers/diagnostics';
import { CodeActionsProvider } from "./providers/codeActions";
import { HoverProvider } from "./providers/hover";
import { ReferenceProvider } from "./providers/references";
import { DefinitionProvider } from "./providers/definition";
import { RenameProvider } from "./providers/rename";
import { Logger } from "./utils/logger";
import { DefinitionParams, RenameParams } from 'vscode-languageserver-protocol';

// Create connection
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Initialize components
const documentManager = new DocumentManager();
const completionProvider = new CompletionProvider(documentManager);
const diagnosticsProvider = new DiagnosticsProvider(documentManager);
const codeActionsProvider = new CodeActionsProvider(documentManager);
const hoverProvider = new HoverProvider(documentManager);
const referenceProvider = new ReferenceProvider(documentManager);
const definitionProvider = new DefinitionProvider(documentManager);
const renameProvider = new RenameProvider(documentManager);

// logger
const logger = Logger.getInstance("hd.log");

// document methods //
/////////////////////
// Listen for document opens
documents.onDidOpen(async({ document }) => {
	logger.log("In onDidOpen()")
	documentManager.updateDocument(document.uri, document.getText());
	const diagnostic: Diagnostic[] = await diagnosticsProvider.provideDiagnostics(document.uri);
	connection.sendDiagnostics({ uri: document.uri, diagnostics: diagnostic });
});
// Setup document tracking
documents.onDidChangeContent(async({ document }) => {
	logger.log("In onDidChangeContent()")
	documentManager.updateDocument(document.uri, document.getText());

	// send diagnostics from filestructure
	const struct = documentManager.getStructure(document.uri);
	if (struct) {
		// NOTE: this provides live style-related diagnostics but tends to double up diagnostics..
		// connection.sendDiagnostics({uri:document.uri, diagnostics: struct.diagnostics})
	}
});

// listen for doc saves
documents.onDidSave(async (change) => {
	logger.log("In onDidSave()")
	const fileUri = change.document.uri;
	const diagnostic: Diagnostic[] = await diagnosticsProvider.provideDiagnostics(fileUri);
	connection.sendDiagnostics({ uri: fileUri, diagnostics: diagnostic });
});

// Register handlers
connection.onInitialize((params: InitializeParams): InitializeResult => {
	logger.log("In onInitialize()")
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				resolveProvider: true,
			},
			hoverProvider: true,
			documentFormattingProvider: true,
			definitionProvider: true,
			renameProvider: true,
			codeActionProvider: true,
			referencesProvider: true,
		}
	};
});

connection.onCompletion(async(params: CompletionParams): Promise<CompletionItem[]> => {
	logger.log("In onCompletion()")
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return [];
	return completionProvider.provideCompletions(doc, params);
});


connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return null;

	return hoverProvider.provideHover(document, params);
})

connection.onCodeAction((params: CodeActionParams) => {
	const { textDocument, range, context } = params;
	const doc = documents.get(textDocument.uri);
	if (!doc) return [];

	return codeActionsProvider.provideCodeActions(params);
});

connection.onReferences((params: ReferenceParams) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) {
	return [];
	}
		return referenceProvider.provideReferences(doc, params);
});

connection.onDefinition((params: DefinitionParams) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) {
	return [];
	}
	return definitionProvider.provideDefinition(doc, params);
});

connection.onRenameRequest((params: RenameParams) => {
	logger.log("onRenameRequest()")
	logger.log("params position line " + params.position.line)
	logger.log("params position char " + params.position.character)
	const doc = documents.get(params.textDocument.uri);
	if (!doc) {
		return null;
	}
	const refParams: ReferenceParams = {textDocument: params.textDocument, context: {includeDeclaration: true}, position:{line: params.position.line, character: params.position.character}};
	const references = referenceProvider.provideReferences(doc, refParams);
	if (!references) return null;
	logger.log("Found references");
	return renameProvider.provideRename(doc, params, references);
});

documents.listen(connection);
// Start the server
connection.listen();
