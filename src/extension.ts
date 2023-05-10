// for adding configuration options: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
// overall structure: https://code.visualstudio.com/api/get-started/extension-anatomy

// todo
// - detect and handle configuration changes

import * as vscode from "vscode";
import { activate as activateContextMenuCommand } from "./myContextMenuCommand";
import { activate as activateShortcutsView } from "./shortcutsView";
import { activate as activateTreeItemDecorator } from "./treeItemDecorator";

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("coLocate");

  console.log("extension patternGroups option:", config.inspect("patternGroups"));
  debugger;

  activateContextMenuCommand(context);
  activateShortcutsView(context);
  activateTreeItemDecorator(context);
}
