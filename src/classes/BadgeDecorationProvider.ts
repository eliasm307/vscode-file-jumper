import * as vscode from "vscode";
import type { FileMetaData } from "../types";

type FileMetaDataProvider = (filePath: string) => FileMetaData | undefined;

export default class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  constructor(private readonly getFileMetaData: FileMetaDataProvider) {}

  private onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();

  onDidChangeFileDecorations = this.onDidChangeFileDecorationsEmitter.event;

  notifyFileDecorationsChanged(uri?: vscode.Uri | vscode.Uri[]): void {
    console.log("BadgeDecorationProvider#notifyFileDecorationsChanged", uri);
    this.onDidChangeFileDecorationsEmitter.fire(uri);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    return this.createDecorationResult(uri);
  }

  async createDecorationResult(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    const filePath = uri.path;

    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.type === vscode.FileType.Directory) {
      return; // not a file
    }

    console.log("BadgeDecorationProvider#provideFileDecoration", filePath, uri);
    const fileMeta = this.getFileMetaData(filePath);
    if (!fileMeta || !fileMeta.relatedFileGroups?.length) {
      console.warn(
        "BadgeDecorationProvider#provideFileDecoration",
        "No related files found for",
        filePath,
      );
      return; // file has no known related files
    }
    const relatedFileMarkers = fileMeta.relatedFileGroups
      .flat()
      .map(({ marker }) => marker)
      .join("")
      .trim();

    const tooltip = `"${fileMeta.fileType.config.name}" file`;

    console.log("BadgeDecorationProvider#provideFileDecoration", {
      filePath,
      relatedFileMarkers,
      tooltip,
    });
    return new vscode.FileDecoration(relatedFileMarkers, tooltip);
  }
}
