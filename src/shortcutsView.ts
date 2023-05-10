import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const shortcutsDataProvider = new ShortcutsDataProvider();
  vscode.window.registerTreeDataProvider("shortcutsTreeView", shortcutsDataProvider);
}

class Shortcut extends vscode.TreeItem {
  constructor(public readonly uri: vscode.Uri) {
    super(uri.path, vscode.TreeItemCollapsibleState.None);
    // @ts-expect-error [type mismatch]
    this.tooltip = this.label;
    this.command = {
      command: "vscode.open", // Command to open the file
      title: "Open Shortcut",
      arguments: [this.uri],
    };
  }

  contextValue = "shortcut";
}

class ShortcutsDataProvider implements vscode.TreeDataProvider<Shortcut> {
  // Example shortcuts using hardcoded URIs
  private shortcuts: Shortcut[] = [
    new Shortcut(vscode.Uri.file("/path/to/shortcut1")),
    new Shortcut(vscode.Uri.file("/path/to/shortcut2")),
  ];

  getTreeItem(element: Shortcut): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<Shortcut[]> {
    return Promise.resolve(this.shortcuts);
  }
}
