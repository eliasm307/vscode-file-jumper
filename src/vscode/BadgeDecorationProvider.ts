/* eslint-disable no-console */
import * as vscode from "vscode";
import type { DecorationData } from "../types";

export default class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  constructor(
    private readonly config: {
      getDecorationData: (filePath: string) => DecorationData | undefined;
    },
  ) {}

  private onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();

  onDidChangeFileDecorations = this.onDidChangeFileDecorationsEmitter.event;

  notifyFileDecorationsChanged(uri?: vscode.Uri | vscode.Uri[]): void {
    console.warn("BadgeDecorationProvider#notifyFileDecorationsChanged", uri);
    this.onDidChangeFileDecorationsEmitter.fire(uri);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    if (uri.scheme !== "file") {
      return;
    }
    // NOTE: it could be a folder but doing fs.stat to confirm is expensive, so allow this to return no related files
    const data = this.config.getDecorationData(uri.path);

    console.log("provideFileDecoration", uri.path, data);
    return new vscode.FileDecoration(data?.badgeText, data?.tooltip);
  }
}
