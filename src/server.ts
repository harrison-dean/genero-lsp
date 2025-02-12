import {
	CodeAction,
	Hover,
	TextDocuments, 
	createConnection, 
	ProposedFeatures,
	TextDocumentSyncKind,
	CompletionItemKind,
	CompletionItem,
	CompletionParams,
	InitializeResult,
	InitializeParams,
	TextDocumentPositionParams,
	Diagnostic,
	Location,
	ReferenceParams,
	CodeActionParams,
} from 'vscode-languageserver/node';

import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import { DocumentManager } from './lib/documentManager';
import { CompletionProvider } from './providers/completion';
import { DiagnosticsProvider } from './providers/diagnostics';
import { CodeActionsProvider } from "./providers/codeActions";
import { HoverProvider } from "./providers/hover";
import { ReferenceProvider } from "./providers/references";
import { Logger } from "./utils/logger";

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


connection.onHover(async (params: TextDocumentPositionParams): Promise<Hover | null> => {
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

// handle find references requests
connection.onReferences((params: ReferenceParams) => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) {
	return [];
	}
	return referenceProvider.provideReferences(doc, params)
});
documents.listen(connection);
// Start the server
connection.listen();
