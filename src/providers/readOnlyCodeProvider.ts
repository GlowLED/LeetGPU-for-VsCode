import * as vscode from "vscode";

export const READ_ONLY_CODE_SCHEME = "leetgpu-code";

export class ReadOnlyCodeProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly contents = new Map<string, string>();
  private readonly changedEmitter = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this.changedEmitter.event;

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? "// This LeetGPU code preview is no longer available.\n";
  }

  public async show(
    kind: "submission" | "solution",
    codeId: string,
    fileName: string,
    content: string,
    languageId: string
  ): Promise<void> {
    const uri = vscode.Uri.from({
      scheme: READ_ONLY_CODE_SCHEME,
      authority: kind,
      path: `/${safeSegment(codeId, kind)}/${safeSegment(fileName, "solution.txt")}`
    });
    this.contents.set(uri.toString(), content);
    this.changedEmitter.fire(uri);

    const availableLanguages = await vscode.languages.getLanguages();
    const effectiveLanguage = availableLanguages.includes(languageId)
      ? languageId
      : languageId === "mojo" && availableLanguages.includes("python")
        ? "python"
        : "plaintext";
    let document = await vscode.workspace.openTextDocument(uri);
    if (document.languageId !== effectiveLanguage) {
      document = await vscode.languages.setTextDocumentLanguage(document, effectiveLanguage);
    }
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: false,
      preview: true
    });
  }

  public dispose(): void {
    this.contents.clear();
    this.changedEmitter.dispose();
  }
}

function safeSegment(value: string, fallback: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || fallback;
}
