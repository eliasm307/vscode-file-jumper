import type FileType from "./classes/FileType";

export type FileMetaData = {
  fileType: FileType;
  relatedFiles: RelatedFileData[];
};

export type RelatedFileData = {
  typeName: string;
  marker: string;
  fullPath: string;
};

export type KeyPath = string & { __brand: "keyPath" };
