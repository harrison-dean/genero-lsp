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
  TextEdit
} from 'vscode-languageserver/node';
import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import keywords from './resources/4GLKeywords.json';
import types from './resources/built-in_dataTypes.4GLPackage.json';
import packages from './resources/built-in_ui.4GLPackage.json';
import { compileSchema } from './schemaLoader';
import { compileFile } from './compileGeneroFile';



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
      documentFormattingProvider: true,
    }
  };
});

documents.onDidChangeContent(change => {
  // validateTextDocument(change.document);
});


connection.onCompletion((): CompletionItem[] => {
  return keywords.map((keyword: { name: string; type?: string }) => ({
    label: keyword.name,
    kind: CompletionItemKind.Keyword,
    detail: keyword.type || 'keyword',
    documentation: keyword.type ? `Type: ${keyword.type}` : 'No additional information'
  }));
});

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

documents.onDidSave(async (change) => {
  const fileUri = change.document.uri;
  try {
    const output = await compileFile(fileUri);
    const diagnostics = parseDiagnostics(output);

    const lspDiagnostics: LSPDiagnostic[] = diagnostics.map(diag => ({
      range: {
        start: { line: diag.startLine - 1, character: diag.startColumn - 1 },
        end: { line: diag.endLine - 1, character: diag.endColumn - 1 }
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
