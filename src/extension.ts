import * as vscode from "vscode";
import { activate as activateContextMenuCommand } from "./myContextMenuCommand";
import { activate as activateShortcutsView } from "./shortcutsView";
import { activate as activateTreeItemDecorator } from "./treeItemDecorator";

export function activate(context: vscode.ExtensionContext) {
  activateContextMenuCommand(context);
  activateShortcutsView(context);
  activateTreeItemDecorator(context);
}
