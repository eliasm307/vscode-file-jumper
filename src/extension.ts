import * as vscode from "vscode";
import { activate as activateContextMenuCommand } from "./myContextMenuCommand";

export function activate(context: vscode.ExtensionContext) {
  activateContextMenuCommand(context);
}
