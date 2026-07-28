import { createHash } from "node:crypto";
import * as vscode from "vscode";
import { LANGUAGE_SUPPORT_VERSION, SUPPORT_ASSETS } from "../languageSupport/assets";
import { isLeetGpuLanguage } from "../languageSupport/catalog";
import { addUnique, removeValues, withBooleanEntry } from "../utils/configuration";

const SUPPORT_DIRECTORY = ".support";
const MANIFEST = "manifest.json";
const STATE_PREFIX = "leetgpu.languageSupport.paths";
const RECOMMENDATION_PREFIX = "leetgpu.languageSupport.recommendation";
const CPP_EXTENSION = "ms-vscode.cpptools";
const PYLANCE_EXTENSION = "ms-python.vscode-pylance";
const MOJO_EXTENSION = "modular-mojotools.vscode-mojo";

interface ManagedPaths {
  python: string;
  cuda: string;
  mojo: string;
  hidden: string;
}

interface SupportManifest {
  schemaVersion: 1;
  supportVersion: number;
  assetHash: string;
  generatedAt: string;
}

const ASSET_HASH = createHash("sha256")
  .update(SUPPORT_ASSETS.map((asset) => `${asset.path}\0${asset.content}`).join("\0"))
  .digest("hex");

export class LanguageSupportManager implements vscode.Disposable {
  private readonly initialized = new Set<string>();

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly log: vscode.LogOutputChannel
  ) {}

  public async ensureForSolution(uri: vscode.Uri, language: string): Promise<void> {
    if (!isLeetGpuLanguage(language) || !this.enabled(uri)) return;
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return;

    const rootName = this.solutionDirectory(folder);
    const supportUri = vscode.Uri.joinPath(folder.uri, ...rootName.split("/"), SUPPORT_DIRECTORY);
    const key = supportUri.toString();
    if (!this.initialized.has(key)) {
      await this.writeAssetsIfNeeded(supportUri, false);
      await this.configureFolder(folder, rootName);
      this.initialized.add(key);
    }
    void this.suggestExtension(language).catch((error) => this.log.warn(error instanceof Error ? error.message : String(error)));
  }

  public async rebuild(uri?: vscode.Uri): Promise<void> {
    const folder = (uri && vscode.workspace.getWorkspaceFolder(uri)) ?? vscode.workspace.workspaceFolders?.[0];
    if (!folder) throw new Error("Open a workspace folder before rebuilding LeetGPU language support.");
    const rootName = this.solutionDirectory(folder);
    const supportUri = vscode.Uri.joinPath(folder.uri, ...rootName.split("/"), SUPPORT_DIRECTORY);
    await this.writeAssetsIfNeeded(supportUri, true);
    await this.configureFolder(folder, rootName);
    this.initialized.add(supportUri.toString());
  }

  public async handleConfigurationChange(event: vscode.ConfigurationChangeEvent): Promise<void> {
    if (!event.affectsConfiguration("leetgpu.languageSupport.enabled") &&
        !event.affectsConfiguration("leetgpu.solutionDirectory")) return;

    this.initialized.clear();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      if (!this.enabled(folder.uri)) {
        await this.removeManagedConfiguration(folder);
      }
    }
  }

  public dispose(): void {
    this.initialized.clear();
  }

  private enabled(uri: vscode.Uri): boolean {
    return vscode.workspace.getConfiguration("leetgpu", uri).get<boolean>("languageSupport.enabled", true);
  }

  private solutionDirectory(folder: vscode.WorkspaceFolder): string {
    const configured = vscode.workspace.getConfiguration("leetgpu", folder.uri).get<string>("solutionDirectory", "leetgpu");
    const normalized = configured.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new Error("leetgpu.solutionDirectory must be a safe workspace-relative directory.");
    }
    return normalized;
  }

  private async writeAssetsIfNeeded(supportUri: vscode.Uri, force: boolean): Promise<void> {
    const manifestUri = vscode.Uri.joinPath(supportUri, MANIFEST);
    if (!force && await this.manifestIsCurrent(manifestUri)) return;

    await vscode.workspace.fs.createDirectory(supportUri);
    for (const asset of SUPPORT_ASSETS) {
      const segments = asset.path.split("/");
      const uri = vscode.Uri.joinPath(supportUri, ...segments);
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(supportUri, ...segments.slice(0, -1)));
      await vscode.workspace.fs.writeFile(uri, Buffer.from(asset.content, "utf8"));
    }
    const manifest: SupportManifest = {
      schemaVersion: 1,
      supportVersion: LANGUAGE_SUPPORT_VERSION,
      assetHash: ASSET_HASH,
      generatedAt: new Date().toISOString()
    };
    await vscode.workspace.fs.writeFile(manifestUri, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
    this.log.info(`LeetGPU language support generated at ${supportUri.toString(true)}`);
  }

  private async manifestIsCurrent(uri: vscode.Uri): Promise<boolean> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const manifest = JSON.parse(Buffer.from(bytes).toString("utf8")) as Partial<SupportManifest>;
      return manifest.schemaVersion === 1 &&
        manifest.supportVersion === LANGUAGE_SUPPORT_VERSION &&
        manifest.assetHash === ASSET_HASH;
    } catch {
      return false;
    }
  }

  private async configureFolder(folder: vscode.WorkspaceFolder, rootName: string): Promise<void> {
    const supportUri = vscode.Uri.joinPath(folder.uri, ...rootName.split("/"), SUPPORT_DIRECTORY);
    const paths: ManagedPaths = {
      python: `\${workspaceFolder}/${rootName}/${SUPPORT_DIRECTORY}/python`,
      cuda: `\${workspaceFolder}/${rootName}/${SUPPORT_DIRECTORY}/cuda/include`,
      mojo: vscode.Uri.joinPath(supportUri, "mojo").fsPath,
      hidden: `${rootName}/${SUPPORT_DIRECTORY}`
    };
    const previous = this.context.workspaceState.get<ManagedPaths>(this.stateKey(folder));

    if (vscode.extensions.getExtension(PYLANCE_EXTENSION)) {
      await this.mergeArraySetting(folder, "python.analysis", "extraPaths", paths.python, previous?.python);
    }
    if (vscode.extensions.getExtension(CPP_EXTENSION)) {
      await this.mergeArraySetting(folder, "C_Cpp.default", "includePath", paths.cuda, previous?.cuda);
    }
    if (vscode.extensions.getExtension(MOJO_EXTENSION)) {
      await this.mergeWorkspaceArraySetting("mojo.lsp", "includeDirs", paths.mojo, previous?.mojo);
    }
    await this.mergeBooleanSetting(folder, "files", "exclude", paths.hidden, previous?.hidden);
    await this.mergeBooleanSetting(folder, "search", "exclude", paths.hidden, previous?.hidden);
    await this.context.workspaceState.update(this.stateKey(folder), paths);
  }

  private async removeManagedConfiguration(folder: vscode.WorkspaceFolder): Promise<void> {
    const previous = this.context.workspaceState.get<ManagedPaths>(this.stateKey(folder));
    if (!previous) return;
    if (vscode.extensions.getExtension(PYLANCE_EXTENSION)) {
      await this.removeArraySetting(folder, "python.analysis", "extraPaths", previous.python);
    }
    if (vscode.extensions.getExtension(CPP_EXTENSION)) {
      await this.removeArraySetting(folder, "C_Cpp.default", "includePath", previous.cuda);
    }
    if (vscode.extensions.getExtension(MOJO_EXTENSION)) {
      await this.removeWorkspaceArraySetting("mojo.lsp", "includeDirs", previous.mojo);
    }
    await this.removeBooleanSetting(folder, "files", "exclude", previous.hidden);
    await this.removeBooleanSetting(folder, "search", "exclude", previous.hidden);
    await this.context.workspaceState.update(this.stateKey(folder), undefined);
  }

  private async mergeArraySetting(
    folder: vscode.WorkspaceFolder,
    section: string,
    name: string,
    addition: string,
    previous?: string
  ): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(section, folder.uri);
    if (!configuration.inspect(name)) return;
    const current = configuration.get<string[]>(name, []);
    const next = addUnique(removeValues(current, previous ? [previous] : []), [addition]);
    if (!arraysEqual(current, next)) {
      await this.safeUpdate(configuration, name, next, vscode.ConfigurationTarget.WorkspaceFolder, `${section}.${name}`);
    }
  }

  private async removeArraySetting(folder: vscode.WorkspaceFolder, section: string, name: string, value: string): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(section, folder.uri);
    if (!configuration.inspect(name)) return;
    const current = configuration.get<string[]>(name, []);
    const next = removeValues(current, [value]);
    if (!arraysEqual(current, next)) {
      await this.safeUpdate(configuration, name, next, vscode.ConfigurationTarget.WorkspaceFolder, `${section}.${name}`);
    }
  }

  private async mergeWorkspaceArraySetting(
    section: string,
    name: string,
    addition: string,
    previous?: string
  ): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(section);
    if (!configuration.inspect(name)) return;
    const current = configuration.get<string[]>(name, []);
    const next = addUnique(removeValues(current, previous ? [previous] : []), [addition]);
    if (!arraysEqual(current, next)) {
      await this.safeUpdate(configuration, name, next, vscode.ConfigurationTarget.Workspace, `${section}.${name}`);
    }
  }

  private async removeWorkspaceArraySetting(section: string, name: string, value: string): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(section);
    if (!configuration.inspect(name)) return;
    const current = configuration.get<string[]>(name, []);
    const next = removeValues(current, [value]);
    if (!arraysEqual(current, next)) {
      await this.safeUpdate(configuration, name, next, vscode.ConfigurationTarget.Workspace, `${section}.${name}`);
    }
  }

  private async mergeBooleanSetting(
    folder: vscode.WorkspaceFolder,
    section: string,
    name: string,
    addition: string,
    previous?: string
  ): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(section, folder.uri);
    if (!configuration.inspect(name)) return;
    const current = configuration.get<Record<string, boolean>>(name, {});
    const withoutPrevious = { ...current };
    if (previous && previous !== addition) delete withoutPrevious[previous];
    const next = withBooleanEntry(withoutPrevious, addition, true);
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      await this.safeUpdate(configuration, name, next, vscode.ConfigurationTarget.WorkspaceFolder, `${section}.${name}`);
    }
  }

  private async removeBooleanSetting(folder: vscode.WorkspaceFolder, section: string, name: string, value: string): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(section, folder.uri);
    if (!configuration.inspect(name)) return;
    const current = configuration.get<Record<string, boolean>>(name, {});
    if (!(value in current)) return;
    const next = { ...current };
    delete next[value];
    await this.safeUpdate(configuration, name, next, vscode.ConfigurationTarget.WorkspaceFolder, `${section}.${name}`);
  }

  private async safeUpdate(
    configuration: vscode.WorkspaceConfiguration,
    name: string,
    value: unknown,
    target: vscode.ConfigurationTarget,
    fullName: string
  ): Promise<void> {
    try {
      await configuration.update(name, value, target);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.log.warn(`Skipped optional language-support setting ${fullName}: ${detail}`);
    }
  }

  private async suggestExtension(language: string): Promise<void> {
    if (!vscode.workspace.getConfiguration("leetgpu").get<boolean>("languageSupport.suggestExtensions", true)) return;
    const recommendation = extensionRecommendation(language);
    if (!recommendation || recommendation.ids.every((id) => vscode.extensions.getExtension(id))) return;
    const stateKey = `${RECOMMENDATION_PREFIX}.${recommendation.key}`;
    if (this.context.globalState.get<boolean>(stateKey)) return;
    await this.context.globalState.update(stateKey, true);

    const install = await vscode.window.showInformationMessage(
      `${recommendation.label} adds semantic IntelliSense to LeetGPU solutions. The built-in fallback completion works without it.`,
      `Install ${recommendation.label}`
    );
    if (install) {
      for (const id of recommendation.ids) {
        await vscode.commands.executeCommand("workbench.extensions.installExtension", id);
      }
    }
  }

  private stateKey(folder: vscode.WorkspaceFolder): string {
    return `${STATE_PREFIX}.${folder.uri.toString()}`;
  }
}

function extensionRecommendation(language: string): { key: string; label: string; ids: string[] } | undefined {
  if (language === "cuda") return { key: "cuda", label: "Microsoft C/C++", ids: [CPP_EXTENSION] };
  if (["triton", "pytorch", "jax", "cute"].includes(language)) {
    return { key: "python", label: "Python and Pylance", ids: ["ms-python.python", PYLANCE_EXTENSION] };
  }
  if (language === "mojo") return { key: "mojo", label: "Mojo", ids: [MOJO_EXTENSION] };
  return undefined;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
