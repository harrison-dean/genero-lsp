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
  Diagnostic,
  DiagnosticSeverity,
  TextEdit
} from 'vscode-languageserver/node';
import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import keywords from './resources/4GLKeywords.json';
import types from './resources/built-in_dataTypes.4GLPackage.json';
import packages from './resources/built-in_ui.4GLPackage.json';
import { compileSchema } from './schemaLoader';
import { compileGeneroFile } from './compileGeneroFile';



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

interface Packages {
  $schema?: string;
  [key: string]: PackageInfo | string | undefined;
}

// Filter out the $schema property
const { $schema, ...filteredPackages } = packages;
const packagesData: Packages = filteredPackages as unknown as Packages;

// Create a connection for the server. The connection uses Node's IPC as a transport.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true
      },
      hoverProvider: true,
      documentFormattingProvider: true
    }
  };
});

documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const filePath = textDocument.uri.replace('file://', '');
  try {
    const output = await compileGeneroFile(filePath);
    const diagnostics: Diagnostic[] = parseCompilerOutput(output, textDocument);
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  } catch (error) {
    const diagnostics: Diagnostic[] = parseCompilerOutput(error, textDocument);
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  }
}

function parseCompilerOutput(output: string, textDocument: TextDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const match = /(.+):(\d+):(\d+):(\d+):(\d+):(warning|error):\((-\d+)\) (.+)/.exec(line);
    if (match) {
      const [, file, startLineStr, startCharStr, endLineStr, endCharStr, severityStr, code, message] = match;
      const startLine = parseInt(startLineStr, 10) - 1;
      const startChar = parseInt(startCharStr, 10) - 1;
      const endLine = parseInt(endLineStr, 10) - 1;
      const endChar = parseInt(endCharStr, 10) - 1;
      const severity = severityStr === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;
      const diagnostic: Diagnostic = {
        severity,
        range: {
          start: { line: startLine, character: startChar },
          end: { line: endLine, character: endChar }
        },
        message,
        source: 'fglcomp',
        code
      };
      diagnostics.push(diagnostic);
    }
  }
  return diagnostics;
}

connection.onCompletion((): CompletionItem[] => {
  return keywords.map((keyword: { name: string; type?: string }) => ({
    label: keyword.name,
    kind: CompletionItemKind.Keyword,
    detail: keyword.type || 'keyword',
    documentation: keyword.type ? `Type: ${keyword.type}` : 'No additional information'
  }));
});

connection.onHover((params): Hover | null => {
  const { textDocument, position } = params;
  const document = documents.get(textDocument.uri);
  if (!document) return null;

  const word = getWordAtPosition(document, position);
  const packageInfo = packagesData[word];
  if (packageInfo && typeof packageInfo !== 'string') {
    return {
      contents: packageInfo.description || 'No description available'
    };
  }
  return null;
});

function getWordAtPosition(document: TextDocument, position: Position): string {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const start = text.lastIndexOf(' ', offset) + 1;
  const end = text.indexOf(' ', offset);
  return text.substring(start, end === -1 ? text.length : end);
}

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

function formatGeneroCode(text: string): string {
  // Implement your formatting logic here
  return text;
}

documents.listen(connection);
connection.listen();
