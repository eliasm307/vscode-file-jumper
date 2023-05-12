import type * as vscode from "vscode"; // type only import to make sure we dont have dependency on vscode effects to make testing easier
import { QuickPickItemKind } from "vscode";
import type { FileGroupConfigs } from "../utils/config";
import BadgeDecorationProvider from "./BadgeDecorationProvider";
import FileType from "./FileType";
import { isNotNullOrUndefined } from "../utils/predicates";
import type { FileMetaData } from "../types";
import { getShortPath } from "../utils/vscode";

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

  private subscriptions: vscode.Disposable[] = [];

  private fileTypeGroups: FileType[][] = [];

  constructor(
    public readonly extension: {
      context: vscode.ExtensionContext;
      patternGroupsConfig: FileGroupConfigs;
    },
  ) {
    this.fileTypeGroups = this.extension.patternGroupsConfig.map((fileGroupConfig) => {
      return fileGroupConfig.types.map((config) => {
        return new FileType(config);
      });
    });

    this.badgeDecorationProvider = new BadgeDecorationProvider((config) => {
      return this.getFileMetaData(config);
    });
  }

  dispose() {
    this.subscriptions.forEach((s) => s.dispose());
  }

  loadNewWorkspaceFiles(filePaths: string[]): void {
    this.fileTypeGroups.forEach((fileGroup) => {
      fileGroup.forEach((fileTypeMatcher) => {
        fileTypeMatcher.reset();
        fileTypeMatcher.registerPaths(filePaths);
      });
    });
  }

  getFileType(filePath: string): FileType | undefined {
    for (const fileTypeGroup of this.fileTypeGroups) {
      for (const fileType of fileTypeGroup) {
        if (fileType.matches(filePath)) {
          return fileType;
        }
      }
    }
  }

  getFileMetaData(targetFilePath: string): FileMetaData | undefined {
    const targetFileType = this.getFileType(targetFilePath);
    if (!targetFileType) {
      console.warn(
        "CoLocator#getFileMetaData",
        `No file type found for "${targetFilePath}" assuming it is not part of any group`,
      );
      return; // file is not part of any group
    }

    const relatedFileGroups = this.fileTypeGroups.map((fileGroup) => {
      return (
        fileGroup
          // eslint-disable-next-line array-callback-return
          .map((fileType) => {
            if (fileType === targetFileType) {
              return;
            }
            const keyPath = targetFileType.getKeyPath(targetFilePath);
            if (keyPath) {
              return fileType.getRelatedFile(keyPath);
            }
          })
          .filter(isNotNullOrUndefined)
      );
    });

    return {
      fileType: targetFileType,
      relatedFileGroups,
    };
  }

  getRelatedFilesQuickPickItems(currentFilePath: string): QuickPickItem[] {
    const fileMeta = this.getFileMetaData(currentFilePath);
    if (!fileMeta || !fileMeta.relatedFileGroups?.length) {
      return []; // file has no known related files
    }

    console.log("getRelatedFilesQuickPickItems", { currentFilePath, fileMeta });

    return fileMeta.relatedFileGroups.flatMap((relatedFileGroup, i) => {
      const groupItems = relatedFileGroup
        // dont include the current file as a related file
        .filter((relatedFile) => relatedFile.fullPath !== currentFilePath)
        .map((relatedFile): QuickPickItem => {
          return {
            kind: QuickPickItemKind.Default,
            label: `${relatedFile.marker} ${relatedFile.typeName}`,
            detail: getShortPath(relatedFile.fullPath),
            filePath: relatedFile.fullPath,
          };
        });

      const isLastGroup = i === fileMeta.relatedFileGroups.length - 1;
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
