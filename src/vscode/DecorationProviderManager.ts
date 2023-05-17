/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as vscode from "vscode";
import type FileType from "../classes/FileType";
import type { DecorationData } from "../types";
import DecorationProvider from "./DecorationProvider";

export default class DecorationProviderManager {
  private subscriptions: vscode.Disposable[] = [];

  private decorationProviders: DecorationProvider[] = [];

  constructor(
    private readonly config: {
      getDecorationData: ({
        decoratorFileType,
        path,
      }: {
        decoratorFileType: FileType;
        path: string;
      }) => DecorationData | undefined;
    },
  ) {}

  setFileTypes(fileTypes: FileType[]): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.decorationProviders = fileTypes.map((decoratorFileType) => {
      return new DecorationProvider({
        getDecorationData: (path) => this.config.getDecorationData({ decoratorFileType, path }),
      });
    });
    this.subscriptions = this.decorationProviders.map((provider) => {
      return vscode.window.registerFileDecorationProvider(provider);
    });
  }

  notifyFileDecorationsChanged(affectedPaths: string[] | null) {
    const affectedPathUris = affectedPaths?.map((path) => vscode.Uri.file(path));
    this.decorationProviders.forEach((provider) => provider.notifyFileDecorationsChanged(affectedPathUris));
  }

  dispose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  }
}
