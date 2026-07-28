import * as vscode from "vscode";
import { escapeHtml } from "../utils/html";

export class ConsoleViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private readonly pending: Array<{ type: string; [key: string]: unknown }> = [];

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")]
    };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((message: { command?: string }) => {
      if (message.command === "cancel") void vscode.commands.executeCommand("leetgpu.cancel");
      if (message.command === "clear") this.clear();
    });
    for (const message of this.pending.splice(0)) void view.webview.postMessage(message);
  }

  public clear(): void {
    this.send({ type: "clear" });
  }

  public write(text: string, stream = "stdout"): void {
    this.send({ type: "write", text, stream });
  }

  public setRunning(running: boolean, label?: string): void {
    this.send({ type: "state", running, label });
  }

  public reveal(): void {
    this.view?.show?.(true);
    void vscode.commands.executeCommand("workbench.action.focusPanel");
  }

  private send(message: { type: string; [key: string]: unknown }): void {
    if (this.view) void this.view.webview.postMessage(message);
    else this.pending.push(message);
  }

  private html(webview: vscode.Webview): string {
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "console.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "console.css"));
    const nonce = getNonce();
    return `<!doctype html><html><head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="${style}">
    </head><body>
      <div id="toolbar"><span id="state">Ready</span><span class="spacer"></span><button id="clear">Clear</button><button id="cancel" hidden>Cancel</button></div>
      <pre id="output" aria-live="polite">${escapeHtml("LeetGPU Console ready.\n")}</pre>
      <script nonce="${nonce}" src="${script}"></script>
    </body></html>`;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
