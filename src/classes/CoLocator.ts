import type * as vscode from "vscode"; // type only import to make sure we dont have dependency on vscode effects to make testing easier
import { FileGroupConfigs, FileTypeConfig } from "../utils/config";
import { QuickPickItemKind } from "vscode";
import { getShortPath } from "../utils/vscode";
import BadgeDecorationProvider from "./BadgeDecorationProvider";
import FileType, { RelatedFileData } from "./FileType";
import { isNotNullOrUndefined } from "../utils/predicates";

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
        return new FileType(config, {
          onFileRelationshipChange: (filePath) => {
            this.badgeDecorationProvider.notifyFileDecorationsChanged();
          },
        });
      });
    });

    this.badgeDecorationProvider = new BadgeDecorationProvider((config) =>
      this.getDecorationData(config),
    );
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

  getFileMetaData(
    filePath: string,
  ): { fileType: FileType; relatedFileGroups: RelatedFileData[][] } | undefined {
    const fileType = this.getFileType(filePath);
    if (!fileType) {
      return; // file is not part of any group
    }

    const relatedFileGroups = this.fileTypeGroups.map((fileGroup) => {
      return fileGroup
        .map((fileType) => {
          if (fileType !== fileType) {
            return fileType.getRelatedFile(filePath);
          }
        })
        .filter(isNotNullOrUndefined);
    });

    return {
      fileType: fileType,
      relatedFileGroups,
    };
  }

  getDecorationData({
    filePath,
    cancelToken,
  }: {
    filePath: string;
    cancelToken?: vscode.CancellationToken;
  }): { badge: string; tooltip: string } | undefined {
    // todo handle cancel

    const fileMeta = this.getFileMetaData(filePath);
    if (!fileMeta || !fileMeta.relatedFileGroups?.length) {
      return; // file has no known related files
    }

    const relatedFileMarkers = fileMeta.relatedFileGroups
      .flat()
      .map(({ marker }) => marker)
      .join("");

    console.log("getDecorationData", filePath, { fileMeta, relatedFileMarkers });
    return {
      badge: relatedFileMarkers,
      tooltip: `This file is a "${fileMeta.fileType.config.name}" file`,
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
            label: `${relatedFile.marker} ${relatedFile.name}`,
            detail: relatedFile.shortPath,
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
