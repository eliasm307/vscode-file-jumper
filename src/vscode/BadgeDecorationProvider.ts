import * as vscode from "vscode";

export default class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  constructor(
    private readonly config: {
      getRelatedFileMarkers: (filePath: string) => string | undefined;
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
    return this.createDecorationResult(uri);
  }

  async createDecorationResult(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    const badgeText = await this.getBadgeText(uri);
    return new vscode.FileDecoration(badgeText);
  }

  async getBadgeText(uri: vscode.Uri): Promise<string | undefined> {
    if (await this.isFileUri(uri)) {
      return this.config.getRelatedFileMarkers(uri.path);
    }
  }

  async isFileUri(uri: vscode.Uri): Promise<boolean> {
    if (uri.scheme !== "file") {
      return false;
    }

    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return stat.type === vscode.FileType.File; // could be a folder
    } catch (error) {
      console.warn("BadgeDecorationProvider#isFile", error);
      return false;
    }
  }
}
