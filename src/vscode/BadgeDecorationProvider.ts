import * as vscode from "vscode";
import type { DecorationData } from "../types";
import Logger from "../classes/Logger";

export default class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  constructor(
    private readonly config: {
      getDecorationData: (path: string) => DecorationData | undefined;
    },
  ) {}

  private onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();

  onDidChangeFileDecorations = this.onDidChangeFileDecorationsEmitter.event;

  notifyFileDecorationsChanged(affectedPaths?: vscode.Uri[]): void {
    Logger.warn("BadgeDecorationProvider#notifyFileDecorationsChanged", affectedPaths);
    this.onDidChangeFileDecorationsEmitter.fire(affectedPaths);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    if (uri.scheme !== "file") {
      return;
    }
    // NOTE: it could be a folder but doing fs.stat to confirm is expensive, so allow this to return no related files
    const data = this.config.getDecorationData(uri.path);
    if (data) {
      return new vscode.FileDecoration(data.badgeText, data.tooltip);
    }
  }
}
