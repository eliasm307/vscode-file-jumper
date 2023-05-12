import * as vscode from "vscode";

export async function openFile(filePath: string) {
  // see built in commands: https://code.visualstudio.com/api/references/commands
  const uri = vscode.Uri.file(filePath);
  const uri2 = vscode.Uri.parse(filePath);

  console.log("openFile", {
    filePath,
    uri,
    uri2,
  });

  await vscode.commands.executeCommand("vscode.open", uri);

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
