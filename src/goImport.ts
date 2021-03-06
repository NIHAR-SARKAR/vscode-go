/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import { getBinPath } from './goPath'
import { parseFilePrelude } from './util'

export function listPackages(): Thenable<string[]> {
	return new Promise<string[]>((resolve, reject) => {
		cp.execFile(getBinPath("gopkgs"), [], (err, stdout, stderr) => {
			if (err && (<any>err).code == "ENOENT") {
				vscode.window.showInformationMessage("The 'gopkgs' command is not available.  Use 'go get github.com/tpng/gopkgs' to install.");
				return reject();
			}
			var lines = stdout.toString().split('\n');
			return resolve(lines);
		});
	});
}

function askUserForImport(): Thenable<string> {
	return listPackages().then(packages => {
		return vscode.window.showQuickPick(packages);
	});
}

export function addImport(arg: string) {
	let p = arg ? Promise.resolve(arg) : askUserForImport();
	p.then(imp => {
		// Import name wasn't provided
		if (imp == undefined) {
			return null;
		}

		let {imports, pkg} = parseFilePrelude(vscode.window.activeTextEditor.document.getText());
		let multis = imports.filter(x => x.kind == "multi");
		if (multis.length > 0) {
			// There is a multiple import declaration, add to the last one
			let closeParenLine = multis[multis.length - 1].end;
			return vscode.window.activeTextEditor.edit(editBuilder => {
				editBuilder.insert(new vscode.Position(closeParenLine, 0), '\t"' + imp + '"\n');
			});
		} else if (imports.length > 0) {
			// There are only single import declarations, add after the last one
			let lastSingleImport = imports[imports.length - 1].end;
			return vscode.window.activeTextEditor.edit(editBuilder => {
				editBuilder.insert(new vscode.Position(lastSingleImport + 1, 0), 'import "' + imp + '"\n');
			});
		} else if (pkg && pkg.start >= 0) {
			// There are no import declarations, but there is a package declaration
			return vscode.window.activeTextEditor.edit(editBuilder => {
				editBuilder.insert(new vscode.Position(pkg.start + 1, 0), '\nimport (\n\t"' + imp + '"\n)\n');
			});
		} else {
			// There are no imports and no package declaration - give up
			return null;
		}
	});
} 