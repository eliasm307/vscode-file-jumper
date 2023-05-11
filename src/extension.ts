// for adding configuration options: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
// overall structure: https://code.visualstudio.com/api/get-started/extension-anatomy

// todo
// - detect and handle configuration changes

import * as vscode from "vscode";
import { activate as activateContextMenuCommand } from "./myContextMenuCommand";
import { activate as activateShortcutsView } from "./shortcutsView";
import { activate as activateTreeItemDecorator } from "./treeItemDecorator";
import { getPatternGroupsConfig, configIsValid } from "./utils/config";
import { FeatureContext } from "./types";
import CoLocator from "./classes/CoLocator";

export function activate(context: vscode.ExtensionContext) {
  console.log("extension activating...");

  const patternGroupsConfig = getPatternGroupsConfig(context);

  if (!configIsValid(patternGroupsConfig)) {
    console.error("Invalid extension configuration");
    return;
  }

  console.log("extension loaded with patternGroupsConfig:", patternGroupsConfig[0]);

  const featureContext: FeatureContext = {
    extension: {
      context: context,
      patternGroupsConfig: patternGroupsConfig,
    },
    coLocator: new CoLocator({
      context: context,
      patternGroupsConfig: patternGroupsConfig,
    }),
  };

  activateContextMenuCommand(featureContext);
  // activateShortcutsView(featureContext);
  activateTreeItemDecorator(featureContext);

  console.log("extension activated");
}
