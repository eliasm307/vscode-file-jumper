import type * as vscode from "vscode";
import { FeatureContext } from "../types";

export default class CoLocator implements vscode.Disposable {
  constructor(public readonly extension: FeatureContext["extension"]) {}

  dispose() {
    // throw new Error("Method not implemented.");
  }
}
