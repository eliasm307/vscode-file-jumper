import * as vscode from "vscode";

export default class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  constructor(private readonly getRelatedFileMarkers: (filePath: string) => string | undefined) {}

  private onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();

  onDidChangeFileDecorations = this.onDidChangeFileDecorationsEmitter.event;

  notifyFileDecorationsChanged(uri?: vscode.Uri | vscode.Uri[]): void {
    console.warn("BadgeDecorationProvider#notifyFileDecorationsChanged", uri);
    this.onDidChangeFileDecorationsEmitter.fire(uri);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    return this.createDecorationResult(uri);
  }

  async createDecorationResult(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    const badgeText = await this.getBadgeText(uri);
    return new vscode.FileDecoration(badgeText);
  }

  async getBadgeText(uri: vscode.Uri): Promise<string | undefined> {
    const filePath = uri.path;
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type === vscode.FileType.Directory) {
        return; // not a file
      }
    } catch (error) {
      console.warn("BadgeDecorationProvider#createDecorationResult", error);
      return; // not a file
    }

    return this.getRelatedFileMarkers(filePath);
  }
}
