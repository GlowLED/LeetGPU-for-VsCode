import * as vscode from "vscode";
import type { WorkspaceManager } from "../services/workspaceManager";

export class SolutionCodeLensProvider implements vscode.CodeLensProvider {
  public constructor(private readonly workspace: WorkspaceManager) {}

  public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const solution = await this.workspace.getActiveSolution(document);
    if (!solution) return [];
    const range = new vscode.Range(0, 0, 0, 0);
    return [
      new vscode.CodeLens(range, { command: "leetgpu.run", title: "$(play) Run" }),
      new vscode.CodeLens(range, { command: "leetgpu.submit", title: "$(cloud-upload) Submit" }),
      new vscode.CodeLens(range, { command: "leetgpu.selectAccelerator", title: "$(server-environment) Select GPU" })
    ];
  }
}
