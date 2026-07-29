import * as vscode from "vscode";
import type { ChallengeDetail } from "../models";
import { escapeHtml, sanitizeChallengeSpec } from "../utils/html";

export interface ProblemPanelHandlers {
  openLanguage(language: string): Promise<void>;
  selectAccelerator(language: string): Promise<void>;
  showAssembly(language: string): Promise<void>;
  run(action: "run" | "submit", language: string): Promise<void>;
  loadSubmissions(language: string): Promise<unknown>;
  loadSolutions(language: string, page: number): Promise<unknown>;
  loadLeaderboard(language: string): Promise<unknown>;
  openSubmission(submissionId: string): Promise<void>;
  openSolution(solutionId: string, fileName: string, content: string): Promise<void>;
}

export class ProblemPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private challenge: ChallengeDetail | undefined;
  private language = "cuda";
  private accelerator = "T4";

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly handlers: ProblemPanelHandlers
  ) {}

  public show(challenge: ChallengeDetail, language: string, accelerator: string): void {
    this.challenge = challenge;
    this.language = language;
    this.accelerator = accelerator;
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "leetgpu.problem",
        `LeetGPU: ${challenge.title}`,
        { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")]
        }
      );
      this.panel.onDidDispose(() => { this.panel = undefined; });
      this.panel.webview.onDidReceiveMessage((message: WebviewMessage) => this.handleMessage(message));
    }
    this.panel.title = `LeetGPU: ${challenge.title}`;
    this.panel.webview.html = this.html(this.panel.webview, challenge);
    this.panel.reveal(vscode.ViewColumn.One, false);
  }

  public updateAccelerator(accelerator: string): void {
    this.accelerator = accelerator;
    void this.panel?.webview.postMessage({ type: "accelerator", accelerator });
  }

  public notifySubmissionComplete(): void {
    void this.panel?.webview.postMessage({ type: "invalidate", tabs: ["submissions", "solutions", "leaderboard"] });
  }

  public showTab(tab: "problem" | "submissions" | "solutions" | "leaderboard"): void {
    this.panel?.reveal(vscode.ViewColumn.One, false);
    void this.panel?.webview.postMessage({ type: "activateTab", tab });
  }

  public dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      if (message.command === "ready") {
        this.sendState();
      } else if (message.command === "openLanguage" && message.language) {
        await this.handlers.openLanguage(message.language);
        this.language = message.language;
        this.sendState();
      } else if (message.command === "selectAccelerator") {
        await this.handlers.selectAccelerator(this.language);
      } else if (message.command === "showAssembly") {
        await this.handlers.showAssembly(this.language);
      } else if (message.command === "action" && (message.action === "run" || message.action === "submit")) {
        await this.handlers.run(message.action, this.language);
      } else if (message.command === "loadTab" && message.tab && message.language) {
        const page = Number.isInteger(message.page) && message.page! > 0 ? message.page! : 1;
        const data = message.tab === "submissions"
          ? await this.handlers.loadSubmissions(message.language)
          : message.tab === "solutions"
            ? await this.handlers.loadSolutions(message.language, page)
            : await this.handlers.loadLeaderboard(message.language);
        void this.panel?.webview.postMessage({ type: "tabData", tab: message.tab, data });
      } else if (message.command === "openSubmission" && message.submissionId) {
        await this.handlers.openSubmission(message.submissionId);
      } else if (
        message.command === "openSolution"
        && message.solutionId
        && message.fileName
        && typeof message.content === "string"
      ) {
        await this.handlers.openSolution(message.solutionId, message.fileName, message.content);
      } else if (message.command === "openExternal" && message.url) {
        const uri = vscode.Uri.parse(message.url);
        if (uri.scheme === "https") await vscode.env.openExternal(uri);
      }
    } catch (error) {
      void this.panel?.webview.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "LeetGPU operation failed."
      });
    }
  }

  private sendState(): void {
    if (!this.challenge) return;
    void this.panel?.webview.postMessage({
      type: "state",
      language: this.language,
      accelerator: this.accelerator,
      languages: this.challenge.starterCode.map((starter) => starter.language.toLowerCase())
    });
  }

  private html(webview: vscode.Webview, challenge: ChallengeDetail): string {
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "problem.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "problem.css"));
    const katexStyle = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "katex", "katex.min.css"));
    const katexScript = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "katex", "katex.min.js"));
    const autoRenderScript = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "katex", "auto-render.min.js"));
    const nonce = getNonce();
    const difficulty = escapeHtml(challenge.difficultyLevel);
    return `<!doctype html><html><head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="${style}">
      <link rel="stylesheet" href="${katexStyle}">
    </head><body>
      <header><div><h1>${escapeHtml(challenge.title)}</h1><span class="badge ${difficulty}">${difficulty}</span></div>
        <div class="controls"><select id="language" aria-label="Language"></select><button id="gpu" type="button" aria-label="Select accelerator" title="Select accelerator"></button><button id="assembly" type="button" hidden>PTX / SASS</button><button id="run">Run</button><button id="submit" class="primary">Submit</button></div>
      </header>
      <nav><button data-tab="problem" class="active">Problem</button><button data-tab="submissions">Submissions</button><button data-tab="solutions">Solutions</button><button data-tab="leaderboard">Leaderboard</button></nav>
      <main><section id="problem" class="tab active spec">${sanitizeChallengeSpec(challenge.spec)}</section>
        <section id="submissions" class="tab"><div class="placeholder">Open this tab to load submissions.</div></section>
        <section id="solutions" class="tab"><div class="placeholder">Open this tab to load public solutions.</div></section>
        <section id="leaderboard" class="tab"><div class="placeholder">Open this tab to load the leaderboard.</div></section>
      </main>
      <div id="toast" role="alert" hidden></div>
      <script nonce="${nonce}" src="${katexScript}"></script>
      <script nonce="${nonce}" src="${autoRenderScript}"></script>
      <script nonce="${nonce}" src="${script}"></script>
    </body></html>`;
  }
}

export function showGlobalLeaderboardPanel(language: string, data: unknown): void {
  const panel = vscode.window.createWebviewPanel(
    "leetgpu.globalLeaderboard",
    `LeetGPU Global Leaderboard · ${language}`,
    vscode.ViewColumn.One,
    { enableScripts: false }
  );
  panel.webview.html = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>${tableStyles()}</style></head><body><h1>Global ${escapeHtml(language)} Leaderboard</h1>${renderTable(extractRows(data))}</body></html>`;
}

interface WebviewMessage {
  command?: string;
  language?: string;
  action?: string;
  tab?: "submissions" | "solutions" | "leaderboard";
  page?: number;
  submissionId?: string;
  solutionId?: string;
  fileName?: string;
  content?: string;
  url?: string;
}

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data)) {
    for (const key of ["leaderboard", "submissions", "solutions"]) {
      const value = data[key];
      if (Array.isArray(value)) return value.filter(isRecord);
    }
  }
  return [];
}

function renderTable(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "<p>No entries are available.</p>";
  const preferred = ["rank", "username", "displayName", "globalScore", "score", "runtime", "language", "accelerator", "status"];
  const allKeys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const keys = [...preferred.filter((key) => allKeys.includes(key)), ...allKeys.filter((key) => !preferred.includes(key))].slice(0, 8);
  const head = keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("");
  const body = rows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(formatCell(row[key]))}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function tableStyles(): string {
  return `body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--vscode-panel-border)}th{color:var(--vscode-descriptionForeground)}`;
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
