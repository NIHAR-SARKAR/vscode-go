/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import { getBinPath } from './goPath'

// Keep in sync with github.com/newhook/go-symbols'
interface GoSymbolDeclaration {
	name: string;
	kind: string;
	package: string;
	path: string;
	line: number;
	character: number;
}

export class GoWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {

	private goKindToCodeKind: { [key: string]: vscode.SymbolKind } = {
		"package": vscode.SymbolKind.Package,
		"import": vscode.SymbolKind.Namespace,
		"var": vscode.SymbolKind.Variable,
		"type": vscode.SymbolKind.Interface,
		"func": vscode.SymbolKind.Function,
		"const": vscode.SymbolKind.Constant,
	}

	public provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
		var convertToCodeSymbols = (decls: GoSymbolDeclaration[], symbols: vscode.SymbolInformation[]): void => {
			decls.forEach(decl => {
				let kind: vscode.SymbolKind;
				if (decl.kind != "") {
					kind = this.goKindToCodeKind[decl.kind]
				}
				let pos = new vscode.Position(decl.line, decl.character)
				let symbolInfo = new vscode.SymbolInformation(
					decl.name,
					kind,
					new vscode.Range(pos, pos),
					vscode.Uri.file(decl.path),
					"");
				symbols.push(symbolInfo);
			});
		}
		let symArgs = vscode.workspace.getConfiguration('go')['symbols'];
		let args = [vscode.workspace.rootPath, query];
		if (symArgs != undefined && symArgs != "") {
			args.unshift(symArgs)
		}
		var gosyms = getBinPath("go-symbols");
		return new Promise((resolve, reject) => {
			var p = cp.execFile(gosyms, args, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
				try {
					if (err && (<any>err).code == "ENOENT") {
						vscode.window.showInformationMessage("The 'go-symbols' command is not available.  Use 'go get -u github.com/newhook/go-symbols' to install.");
					}
					if (err) return resolve(null);
					var result = stdout.toString();
					var decls = <GoSymbolDeclaration[]>JSON.parse(result);
					var symbols: vscode.SymbolInformation[] = [];
					convertToCodeSymbols(decls, symbols);
					return resolve(symbols);
				} catch (e) {
					reject(e);
				}
			})
		})
	}
}