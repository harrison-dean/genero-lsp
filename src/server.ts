import {
	CodeAction,
	TextDocuments, 
	createConnection, 
	ProposedFeatures,
	TextDocumentSyncKind,
	CompletionItemKind,
	CompletionItem,
	InitializeResult,
	InitializeParams,
	Diagnostic,
} from 'vscode-languageserver/node';

import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import { DocumentManager } from './lib/documentManager';
import { CompletionProvider } from './providers/completion';
import { DiagnosticsProvider } from './providers/diagnostics';
import { Logger } from "./logger";
import { createRemoveTrailingWhitespaceAction } from "./providers/codeActions";
import { CodeActionsProvider } from "./providers/codeActions";

// Create connection
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Initialize components
const documentManager = new DocumentManager();
const completionProvider = new CompletionProvider(documentManager);
const diagnosticsProvider = new DiagnosticsProvider(documentManager);
const codeActionsProvider = new CodeActionsProvider(documentManager);

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
				resolveProvider: true
			},
			hoverProvider: true,
			documentFormattingProvider: true,
			definitionProvider: true,
			codeActionProvider: true,
		}
	};
});

connection.onCompletion(async(textDocumentPosition): Promise<CompletionItem[]> => {
	logger.log("In onCompletion()")
	return completionProvider.provideCompletions(textDocumentPosition.textDocument.uri);
});

connection.onCodeAction((params) => {
	const { textDocument, range, context } = params;
	const doc = documents.get(textDocument.uri);
	if (!doc) return [];

	const codeActions: CodeAction[] = [];

	// Check if the diagnostic is for trailing whitespace
	const fileStructure = documentManager.getStructure(textDocument.uri);
	if (!fileStructure) { return };
	const diagnostics = fileStructure.diagnostics;
	diagnostics.forEach(diagnostic => {
		if (diagnostic.code === "style/trailing-whitespace") {
			const action = createRemoveTrailingWhitespaceAction(
				diagnostic.range,
				textDocument.uri
			);
			action.diagnostics = [diagnostic]; // Link the action to the diagnostic
			codeActions.push(action);
		}
	});

	return codeActions;
});

documents.listen(connection);
// Start the server
connection.listen();
