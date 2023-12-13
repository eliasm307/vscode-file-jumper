/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as vscode from "vscode";
import type { DecorationData } from "../types";
import DecorationProvider from "./DecorationProvider";

export default class DecorationProviderManager implements vscode.Disposable {
  private subscriptions: vscode.Disposable[] = [];

  private decorationProviders: DecorationProvider[] = [];

  constructor(
    private readonly config: {
      getDecorationData: ({
        fileTypeName,
        path,
      }: {
        fileTypeName: string;
        path: string;
      }) => DecorationData | undefined;
    },
  ) {}

  private disposeRegisteredProviders(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions = [];
  }

  setFileTypeNames(newFileTypeNames: string[]): void {
    this.disposeRegisteredProviders();

    // create and register a provider for each new file type
    this.decorationProviders = newFileTypeNames.map((fileTypeName) => {
      return new DecorationProvider({
        getDecorationData: (path) => this.config.getDecorationData({ fileTypeName, path }),
      });
    });
    this.subscriptions = this.decorationProviders.map((provider) => {
      return vscode.window.registerFileDecorationProvider(provider);
    });
  }

  notifyFileDecorationsChanged(affectedPaths: string[] | null) {
    const affectedPathUris = affectedPaths?.map((path) => vscode.Uri.file(path));
    this.decorationProviders.forEach((provider) =>
      provider.notifyFileDecorationsChanged(affectedPathUris),
    );
  }

  dispose(): void {
    this.disposeRegisteredProviders();
  }
}
