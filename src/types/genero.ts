import {
	Diagnostic,
	CodeAction,
} from 'vscode-languageserver/node';
///////////
// types //
///////////

export interface GeneroKeyword {
	name: string;
	type?: string;
	description?: string;
	documentation?: string;
}

// 4GL keywords type (flat array)
type FourGlKeywords = GeneroKeyword[];

// PER keywords type (object with nested array)
export interface PerKeywordsData {
	keywords: GeneroKeyword[];
}

type KeywordCollection = GeneroKeyword[] | { keywords: GeneroKeyword[] };

// Define the type for the packages object
export interface PackageInfo {
	name: string;
	type: string;
	description?: string;
	documentation?: string;
	classes?: ClassInfo[];
}

export interface ClassInfo {
	name: string;
	description?: string;
	documentation?: string;
	minimumLanguageVersion?: string;
	maximumLanguageVersion?: string;
	classMethods?: MethodInfo[];
}

export interface MethodInfo {
	name: string;
	description?: string;
	documentation?: string;
	minimumLanguageVersion?: string;
	maximumLanguageVersion?: string;
	parameters?: ParameterInfo[];
	returns?: ReturnInfo[];
}

export interface ParameterInfo {
	name: string;
	type: string;
	description?: string;
}

export interface ReturnInfo {
	type: string;
	description?: string;
}

export interface FileStructure {
	functions: FunctionDef[];
	variables: VariableDef[];
	records: RecordDef[];
	calls: FunctionCall[];
	diagnostics: Diagnostic[];
}

export interface FunctionDef {
	name: string;
	parameters: Parameter[];
	returns: ReturnValue[];
	variables: VariableDef[];
	startLine: number;
	endLine: number;
}

export interface VariableDef {
	name: string;
	type: string;
	scope: 'modular' | string; // Function name or 'modular'
	line: number;
}

export interface RecordDef {
	name: string;
	fields: RecordField[];
	scope: 'modular' | string; // Function name or 'modular'
	line: number;
}

export interface RecordField {
	name: string;
	type: string;
}

export interface FunctionCall {
	name: string;
	line: number;
}

export interface Parameter {
	name: string;
	type: string;
}

export interface ReturnValue {
	name: string;
	type: string;
}

export interface CodeActionExtras {
	line: number;
	action: CodeAction
}
