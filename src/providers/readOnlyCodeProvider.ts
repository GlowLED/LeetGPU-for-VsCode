import * as vscode from "vscode";
import { resolveAvailableEditorLanguage } from "../utils/editorLanguage";

export const READ_ONLY_CODE_SCHEME = "leetgpu-code";

interface CodePreview {
  fileName: string;
  content: string;
  languageId: string;
}

export class ReadOnlyCodeProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly contents = new Map<string, string>();
  private readonly changedEmitter = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this.changedEmitter.event;

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? "// This LeetGPU code preview is no longer available.\n";
  }

  public async show(
    kind: "submission" | "solution" | "assembly",
    codeId: string,
    fileName: string,
    content: string,
    languageId: string
  ): Promise<void> {
    const document = await this.openDocument(kind, codeId, { fileName, content, languageId });
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: false,
      preview: true
    });
  }

  public async showMany(
    kind: "assembly",
    codeId: string,
    previews: CodePreview[]
  ): Promise<void> {
    const documents = await Promise.all(
      previews.map((preview) => this.openDocument(kind, codeId, preview))
    );
    for (let index = documents.length - 1; index >= 0; index -= 1) {
      await vscode.window.showTextDocument(documents[index]!, {
        viewColumn: vscode.ViewColumn.Two,
        preserveFocus: index !== 0,
        preview: false
      });
    }
  }

  private async openDocument(
    kind: "submission" | "solution" | "assembly",
    codeId: string,
    preview: CodePreview
  ): Promise<vscode.TextDocument> {
    const uri = vscode.Uri.from({
      scheme: READ_ONLY_CODE_SCHEME,
      authority: kind,
      path: `/${safeSegment(codeId, kind)}/${safeSegment(preview.fileName, "solution.txt")}`
    });
    this.contents.set(uri.toString(), preview.content);
    this.changedEmitter.fire(uri);

    const availableLanguages = await vscode.languages.getLanguages();
    const effectiveLanguage = resolveAvailableEditorLanguage(preview.languageId, availableLanguages);
    let document = await vscode.workspace.openTextDocument(uri);
    if (document.languageId !== effectiveLanguage) {
      document = await vscode.languages.setTextDocumentLanguage(document, effectiveLanguage);
    }
    return document;
  }

  public dispose(): void {
    this.contents.clear();
    this.changedEmitter.dispose();
  }
}

function safeSegment(value: string, fallback: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || fallback;
}
