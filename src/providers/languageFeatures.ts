import * as vscode from "vscode";
import { completionSymbolsFor, findSymbol, type LanguageSymbol, type SymbolKind } from "../languageSupport/catalog";
import type { WorkspaceManager } from "../services/workspaceManager";

const CPP_EXTENSION = "ms-vscode.cpptools";

export class LeetGpuLanguageFeatures implements
  vscode.CompletionItemProvider,
  vscode.HoverProvider,
  vscode.SignatureHelpProvider {
  public constructor(private readonly workspace: WorkspaceManager) {}

  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[]> {
    if (!languageSupportEnabled(document)) return [];
    const active = await this.workspace.getActiveSolution(document);
    if (!active) return [];
    const namespace = namespaceBeforeCursor(document, position);
    const semanticCudaCompletions = active.language === "cuda" && Boolean(vscode.extensions.getExtension(CPP_EXTENSION));
    return completionSymbolsFor(active.language, namespace, semanticCudaCompletions).map(toCompletionItem);
  }

  public async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
    if (!languageSupportEnabled(document)) return undefined;
    const active = await this.workspace.getActiveSolution(document);
    if (!active) return undefined;
    const range = document.getWordRangeAtPosition(position);
    if (!range) return undefined;
    const found = findSymbol(active.language, document.getText(range));
    if (!found) return undefined;
    const contents = new vscode.MarkdownString();
    contents.appendCodeblock(found.detail, active.language === "cuda" ? "cpp" : active.language === "mojo" ? "mojo" : "python");
    contents.appendMarkdown(`\n${found.documentation}\n\n_LeetGPU offline language model_`);
    return new vscode.Hover(contents, range);
  }

  public async provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.SignatureHelp | undefined> {
    if (!languageSupportEnabled(document)) return undefined;
    const active = await this.workspace.getActiveSolution(document);
    if (!active) return undefined;
    const call = callBeforeCursor(document, position);
    if (!call) return undefined;
    const found = findSymbol(active.language, call.name);
    if (!found?.signature) return undefined;

    const signature = new vscode.SignatureInformation(found.signature, found.documentation);
    signature.parameters = parametersFor(found.signature).map((parameter) => new vscode.ParameterInformation(parameter));
    const help = new vscode.SignatureHelp();
    help.signatures = [signature];
    help.activeSignature = 0;
    help.activeParameter = Math.min(call.commas, Math.max(0, signature.parameters.length - 1));
    return help;
  }
}

function languageSupportEnabled(document: vscode.TextDocument): boolean {
  return vscode.workspace.getConfiguration("leetgpu", document.uri).get<boolean>("languageSupport.enabled", true);
}

function toCompletionItem(symbol: LanguageSymbol): vscode.CompletionItem {
  const item = new vscode.CompletionItem(symbol.label, completionKind(symbol.kind));
  item.detail = symbol.detail;
  item.documentation = new vscode.MarkdownString(`${symbol.documentation}\n\n_LeetGPU offline language model_`);
  item.sortText = `z_leetgpu_${symbol.label}`;
  item.filterText = symbol.label;
  if (symbol.insertText) item.insertText = new vscode.SnippetString(symbol.insertText);
  return item;
}

function completionKind(kind: SymbolKind): vscode.CompletionItemKind {
  switch (kind) {
    case "class": return vscode.CompletionItemKind.Class;
    case "constant": return vscode.CompletionItemKind.Constant;
    case "function": return vscode.CompletionItemKind.Function;
    case "keyword": return vscode.CompletionItemKind.Keyword;
    case "snippet": return vscode.CompletionItemKind.Snippet;
  }
}

function namespaceBeforeCursor(document: vscode.TextDocument, position: vscode.Position): string | undefined {
  const prefix = document.lineAt(position.line).text.slice(0, position.character);
  return prefix.match(/([A-Za-z_][A-Za-z0-9_]*)\.[A-Za-z0-9_]*$/)?.[1];
}

function callBeforeCursor(document: vscode.TextDocument, position: vscode.Position): { name: string; commas: number } | undefined {
  const prefix = document.lineAt(position.line).text.slice(0, position.character);
  const match = prefix.match(/([A-Za-z_][A-Za-z0-9_.]*)\(([^()]*)$/);
  if (!match?.[1]) return undefined;
  return { name: match[1], commas: (match[2]?.match(/,/g) ?? []).length };
}

function parametersFor(signature: string): string[] {
  const value = signature.match(/\((.*)\)/)?.[1];
  return value ? value.split(",").map((parameter) => parameter.trim()).filter(Boolean) : [];
}
