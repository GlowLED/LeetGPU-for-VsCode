import * as vscode from "vscode";
import { MANIFEST_FILE } from "../constants";
import type {
  ActiveSolution,
  ChallengeDetail,
  ChallengeManifest,
  StarterCode
} from "../models";
import { slugify, solutionFileName, starterHash } from "../utils/slug";
import { withSolutionIdentity } from "../utils/solutionIdentity";

const WORKSPACE_SELECTION_KEY = "leetgpu.selectedWorkspaceFolder";

export class WorkspaceManager {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async openChallenge(
    challenge: ChallengeDetail,
    preferredLanguage?: string
  ): Promise<{ uri: vscode.Uri; language: string }> {
    const folder = await this.selectWorkspaceFolder();
    const rootName = vscode.workspace.getConfiguration("leetgpu", folder.uri).get<string>(
      "solutionDirectory",
      "leetgpu"
    );
    validateRelativeDirectory(rootName);

    const rootUri = vscode.Uri.joinPath(folder.uri, ...rootName.split(/[\\/]+/));
    const slug = slugify(challenge.title);
    const existingDirectory = await findChallengeDirectory(rootUri, challenge.id);
    const challengeDir = existingDirectory ?? vscode.Uri.joinPath(rootUri, `${challenge.id}-${slug}`);
    const manifestUri = vscode.Uri.joinPath(challengeDir, MANIFEST_FILE);
    const manifest = (await this.readManifest(manifestUri)) ?? {
      schemaVersion: 1,
      challengeId: challenge.id,
      title: challenge.title,
      slug,
      solutions: {}
    } satisfies ChallengeManifest;

    const starter = selectStarter(challenge.starterCode, preferredLanguage);
    if (!starter) {
      throw new Error("This challenge does not contain a supported starter template.");
    }
    const language = starter.language.toLowerCase();
    const fileName = solutionFileName(language);
    const languageDir = vscode.Uri.joinPath(challengeDir, language);
    const solutionUri = vscode.Uri.joinPath(languageDir, fileName);

    await vscode.workspace.fs.createDirectory(languageDir);
    if (await exists(solutionUri)) {
      await this.ensureSolutionIdentity(solutionUri, challenge, language);
    } else {
      await vscode.workspace.fs.writeFile(
        solutionUri,
        Buffer.from(withSolutionIdentity(starter.fileContent, challenge, language), "utf8")
      );
    }

    manifest.title = challenge.title;
    manifest.solutions[language] = {
      path: `${language}/${fileName}`,
      starterHash: starterHash(starter.fileContent)
    };
    await this.writeManifest(manifestUri, manifest);
    return { uri: solutionUri, language };
  }

  public async resetSolution(challenge: ChallengeDetail, language: string): Promise<vscode.Uri> {
    const starter = challenge.starterCode.find(
      (candidate) => candidate.language.toLowerCase() === language.toLowerCase()
    );
    if (!starter) throw new Error(`No ${language} starter template is available.`);
    const opened = await this.openChallenge(challenge, language);
    const content = withSolutionIdentity(starter.fileContent, challenge, opened.language);
    const document = vscode.workspace.textDocuments.find((candidate) => candidate.uri.toString() === opened.uri.toString());
    if (document) {
      const edit = new vscode.WorkspaceEdit();
      const lastLine = Math.max(0, document.lineCount - 1);
      const end = document.lineAt(lastLine).range.end;
      edit.replace(document.uri, new vscode.Range(0, 0, end.line, end.character), content);
      await vscode.workspace.applyEdit(edit);
      await document.save();
    } else {
      await vscode.workspace.fs.writeFile(opened.uri, Buffer.from(content, "utf8"));
    }
    return opened.uri;
  }

  public async findSolution(challengeId: number, language: string): Promise<ActiveSolution | undefined> {
    const normalizedLanguage = language.toLowerCase();
    for (const folder of this.workspaceFoldersInPriorityOrder()) {
      const rootName = vscode.workspace.getConfiguration("leetgpu", folder.uri).get<string>(
        "solutionDirectory",
        "leetgpu"
      );
      validateRelativeDirectory(rootName);
      const rootUri = vscode.Uri.joinPath(folder.uri, ...rootName.split(/[\\/]+/));
      const challengeDir = await findChallengeDirectory(rootUri, challengeId);
      if (!challengeDir) continue;

      const manifestUri = vscode.Uri.joinPath(challengeDir, MANIFEST_FILE);
      const manifest = await this.readManifest(manifestUri);
      const entry = manifest?.solutions[normalizedLanguage];
      if (
        !manifest
        || manifest.challengeId !== challengeId
        || !entry
        || typeof entry.path !== "string"
        || !isSafeRelativePath(entry.path)
      ) continue;

      const uri = vscode.Uri.joinPath(challengeDir, ...entry.path.split(/[\\/]+/));
      if (!(await isFile(uri))) continue;
      return {
        challengeId: manifest.challengeId,
        title: manifest.title,
        language: normalizedLanguage,
        uri,
        manifestUri
      };
    }
    return undefined;
  }

  public async getActiveSolution(document = vscode.window.activeTextEditor?.document): Promise<ActiveSolution | undefined> {
    if (!document || document.uri.scheme === "untitled") return undefined;
    const manifestUri = vscode.Uri.joinPath(document.uri, "..", "..", MANIFEST_FILE);
    const manifest = await this.readManifest(manifestUri);
    if (!manifest) return undefined;

    const path = document.uri.path;
    const language = Object.entries(manifest.solutions).find(([, entry]) =>
      path.endsWith(`/${entry.path}`)
    )?.[0];
    if (!language) return undefined;
    return {
      challengeId: manifest.challengeId,
      title: manifest.title,
      language,
      uri: document.uri,
      manifestUri
    };
  }

  private async selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      throw new Error("Open a workspace folder before creating a LeetGPU solution.");
    }
    if (folders.length === 1) return folders[0]!;

    const selectedUri = this.context.workspaceState.get<string>(WORKSPACE_SELECTION_KEY);
    const remembered = folders.find((folder) => folder.uri.toString() === selectedUri);
    if (remembered) return remembered;

    const selected = await vscode.window.showQuickPick(
      folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
      { title: "Select the workspace folder for LeetGPU solutions" }
    );
    if (!selected) throw new Error("No workspace folder was selected.");
    await this.context.workspaceState.update(WORKSPACE_SELECTION_KEY, selected.folder.uri.toString());
    return selected.folder;
  }

  private workspaceFoldersInPriorityOrder(): vscode.WorkspaceFolder[] {
    const folders = [...(vscode.workspace.workspaceFolders ?? [])];
    const selectedUri = this.context.workspaceState.get<string>(WORKSPACE_SELECTION_KEY);
    return folders.sort((left, right) =>
      Number(right.uri.toString() === selectedUri) - Number(left.uri.toString() === selectedUri)
    );
  }

  private async ensureSolutionIdentity(
    uri: vscode.Uri,
    challenge: ChallengeDetail,
    language: string
  ): Promise<void> {
    const document = vscode.workspace.textDocuments.find((candidate) => candidate.uri.toString() === uri.toString());
    if (document) {
      const original = document.getText();
      const updated = withSolutionIdentity(original, challenge, language);
      if (updated === original) return;
      const wasDirty = document.isDirty;
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, new vscode.Range(new vscode.Position(0, 0), document.positionAt(original.length)), updated);
      if (!(await vscode.workspace.applyEdit(edit))) {
        throw new Error("Could not add identifying metadata to the LeetGPU solution.");
      }
      if (!wasDirty) await document.save();
      return;
    }

    const original = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
    const updated = withSolutionIdentity(original, challenge, language);
    if (updated !== original) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(updated, "utf8"));
    }
  }

  private async readManifest(uri: vscode.Uri): Promise<ChallengeManifest | undefined> {
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(raw).toString("utf8")) as ChallengeManifest;
      if (
        parsed.schemaVersion !== 1 ||
        typeof parsed.challengeId !== "number" ||
        typeof parsed.title !== "string" ||
        !parsed.solutions
      ) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private async writeManifest(uri: vscode.Uri, manifest: ChallengeManifest): Promise<void> {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  }
}

function selectStarter(starters: StarterCode[], preferred?: string): StarterCode | undefined {
  if (preferred) {
    const match = starters.find((starter) => starter.language.toLowerCase() === preferred.toLowerCase());
    if (match) return match;
  }
  return starters.find((starter) => starter.language.toLowerCase() === "cuda") ?? starters[0];
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function isFile(uri: vscode.Uri): Promise<boolean> {
  try {
    return Boolean((await vscode.workspace.fs.stat(uri)).type & vscode.FileType.File);
  } catch {
    return false;
  }
}

async function findChallengeDirectory(root: vscode.Uri, challengeId: number): Promise<vscode.Uri | undefined> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(root);
    const prefix = `${challengeId}-`;
    const match = entries.find(([name, type]) =>
      type === vscode.FileType.Directory && name.startsWith(prefix)
    );
    return match ? vscode.Uri.joinPath(root, match[0]) : undefined;
  } catch {
    return undefined;
  }
}

function validateRelativeDirectory(value: string): void {
  if (!isSafeRelativePath(value)) {
    throw new Error("leetgpu.solutionDirectory must be a safe workspace-relative directory.");
  }
}

function isSafeRelativePath(value: string): boolean {
  return Boolean(value)
    && !value.startsWith("/")
    && !value.startsWith("\\")
    && !value.split(/[\\/]/).includes("..");
}
