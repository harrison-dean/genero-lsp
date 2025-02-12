An LSP for the Genero language

Features:
* Diagnostics on document open/save parsed from compiler
* Autocompletion suggestions for keywords (4GL and PER)
* Context-aware autocompletion
* Autocompletion for local function names
* Autocompletion for variable names and record fields
* Hover information for local functions (params) and variables (type and scope)
* Style hinting via diagnostics e.g. empty lines, trailing whitespace
* Code actions to quickly resolve diagnostics
* Find scope-level references of variables

To do:
* Hover information for external functions
* Sort code actions by closeness to current line
* Incorrect indentation detection diagnostics + code action(s)
* Go to definition (local funcs/variables AND external funcs)
* Detect parameters as different to variables in completions
* Parse calls to functions
