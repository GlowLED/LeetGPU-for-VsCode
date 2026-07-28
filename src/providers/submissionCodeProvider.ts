import * as vscode from "vscode";

export const SUBMISSION_CODE_SCHEME = "leetgpu-submission";

export class SubmissionCodeProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly contents = new Map<string, string>();
  private readonly changedEmitter = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this.changedEmitter.event;

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? "// This LeetGPU submission is no longer available in this session.\n";
  }

  public async show(
    submissionId: string,
    fileName: string,
    content: string,
    languageId: string
  ): Promise<void> {
    const uri = vscode.Uri.from({
      scheme: SUBMISSION_CODE_SCHEME,
      authority: "history",
      path: `/${safeSegment(submissionId, "submission")}/${safeSegment(fileName, "solution.txt")}`
    });
    this.contents.set(uri.toString(), content);
    this.changedEmitter.fire(uri);

    let document = await vscode.workspace.openTextDocument(uri);
    if (document.languageId !== languageId) {
      document = await vscode.languages.setTextDocumentLanguage(document, languageId);
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
