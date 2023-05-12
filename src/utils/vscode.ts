import * as vscode from "vscode";

export async function openFile(filePath: string) {
  await vscode.commands.executeCommand("vscode.open", createUri(filePath));

  // can also try
  // vscode.workspace.openTextDocument(uri)
}

// const MAX_PATH_SEGMENTS = 5;
export function getShortPath(
  pathOrUri: string | vscode.Uri,
  // options?: { maxSegments?: number }
) {
  const relativePath = vscode.workspace.asRelativePath(pathOrUri, false);

  return relativePath;

  // limit path so theres some context for the user but dont overflow
  // const maxSegments = options?.maxSegments || MAX_PATH_SEGMENTS;
  // let uriSegments = relativePath.split("/");
  // if (uriSegments.length > maxSegments) {
  //   uriSegments = uriSegments.slice(-maxSegments);
  //   uriSegments.unshift("... ");
  // }

  // return uriSegments.join("/").trim();
}

export function createUri(path: string) {
  return vscode.Uri.file(path);
}
