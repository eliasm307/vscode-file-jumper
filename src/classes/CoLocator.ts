import * as vscode from "vscode"; // type only import to make sure we dont have dependency on vscode effects to make testing easier
import { FileGroupConfigs, FileTypeConfig } from "../utils/config";
import { QuickPickItemKind } from "vscode";
import { getShortPath } from "../utils/vscode";
import BadgeDecorationProvider from "./BadgeDecorationProvider";
import PatternMatcher from "./PatternMatcher";

export type QuickPickItem = vscode.QuickPickItem &
  (
    | {
        kind: QuickPickItemKind.Default;
        filePath: string;
      }
    | {
        kind: QuickPickItemKind.Separator;
      }
  );

/**
 * The main facade for the extension logic
 */
export default class CoLocator implements vscode.Disposable {
  // todo use this to notify of updated decorations on change
  public readonly badgeDecorationProvider: BadgeDecorationProvider;
  private fileLinker: PatternMatcher;

  private subscriptions: vscode.Disposable[] = [];

  constructor(
    public readonly extension: {
      context: vscode.ExtensionContext;
      patternGroupsConfig: FileGroupConfigs;
    },
  ) {
    this.fileLinker = new PatternMatcher({
      fileGroupConfigs: extension.patternGroupsConfig,
    });

    this.badgeDecorationProvider = new BadgeDecorationProvider((config) =>
      this.getDecorationData(config),
    );
  }

  dispose() {
    this.subscriptions.forEach((s) => s.dispose());
  }

  loadFiles(filePaths: string[]): void {
    this.fileLinker.clearAllAndLoad(filePaths);
  }

  getDecorationData({
    filePath,
    cancelToken,
  }: {
    filePath: string;
    cancelToken?: vscode.CancellationToken;
  }): { badge: string; tooltip: string } | undefined {
    // todo handle cancel

    const isMatch = filePath.endsWith("test.ts");

    console.log("BadgeDecorationProvider", {
      filePath,
      isMatch,
    });

    if (isMatch) {
      // todo should not add a file here, just use whats available
      this.fileLinker.addFile(filePath);
      return {
        badge: "🧪",
        tooltip: "This file is a test file",
      };
    }
    return undefined;
  }

  getRelatedFilesQuickPickItems(currentFilePath: string): QuickPickItem[] {
    const relatedFileGroups = this.fileLinker.getRelatedFileGroups(currentFilePath);

    console.log("getRelatedFilesQuickPickItems", { currentFilePath, relatedFileGroups });

    return relatedFileGroups.flatMap((relatedFileGroup, i) => {
      const groupItems = relatedFileGroup
        // dont include the current file as a related file
        .filter((relatedFile) => relatedFile.fullPath !== currentFilePath)
        .map((relatedFile): QuickPickItem => {
          return {
            kind: QuickPickItemKind.Default,
            label: `${relatedFile.marker} ${relatedFile.name}`,
            detail: relatedFile.shortPath,
            filePath: relatedFile.fullPath,
          };
        });

      const isLastGroup = i === relatedFileGroups.length - 1;
      if (!isLastGroup) {
        groupItems.push({
          kind: QuickPickItemKind.Separator,
          label: "──────────────────────────────────",
        });
      }

      return groupItems;
    });
  }
}
