import * as vscode from "vscode";

export default class ProviderManager {
  private activeDecoratorSubscriptions: vscode.Disposable[] = [];
}
