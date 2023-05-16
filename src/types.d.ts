import type FileType from "./classes/FileType";

export type FileMetaData = {
  fileType: FileType;
  linkedFiles: LinkedFileData[];
};

export type LinkedFileData = {
  typeName: string;
  marker: string;
  fullPath: string;
};

export type KeyPath = string & { __brand: "keyPath" };

export type DecorationData = { badgeText: string; tooltip: string };
