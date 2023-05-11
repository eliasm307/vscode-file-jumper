import type * as vscode from "vscode";
import CoLocator from "./classes/CoLocator";
import { PatternGroupsConfig } from "./utils/config";

export type FeatureContext = {
  extension: {
    context: vscode.ExtensionContext;
    patternGroupsConfig: PatternGroupsConfig;
  };
  coLocator: CoLocator;
};
