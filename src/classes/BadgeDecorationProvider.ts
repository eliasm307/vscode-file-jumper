import * as vscode from "vscode";
import CoLocator from "./CoLocator";

type DecorationData = { badge: string; tooltip: string };

type DecorationDataFinder = (config: {
  filePath: string;
  cancelToken?: vscode.CancellationToken;
}) => DecorationData | undefined;

export default class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  constructor(private readonly getDecorationData: DecorationDataFinder) {}

  private onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  onDidChangeFileDecorations = this.onDidChangeFileDecorationsEmitter.event;

  notifyFileDecorationsChanged(uri?: vscode.Uri | vscode.Uri[]): void {
    this.onDidChangeFileDecorationsEmitter.fire(uri);
  }

  provideFileDecoration(
    uri: vscode.Uri,
    cancelToken: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const decoration = this.getDecorationData({
      filePath: uri.path,
      cancelToken,
    });
    if (decoration) {
      return new vscode.FileDecoration(decoration.badge, decoration.tooltip);
    }
  }
}
