import * as vscode from "vscode";
import { SUPPORTED_LANGUAGE_LABELS } from "./constants";
import type { ChallengeDetail, ChallengeSummary, SubmissionEvent, SubmissionPayload } from "./models";
import { ChallengeTreeProvider } from "./providers/challengeTree";
import { ConsoleViewProvider } from "./providers/consoleView";
import { LeetGpuLanguageFeatures } from "./providers/languageFeatures";
import { ProblemPanel, showGlobalLeaderboardPanel } from "./providers/problemPanel";
import { SolutionCodeLensProvider } from "./providers/solutionCodeLens";
import { LeetGpuClient } from "./services/apiClient";
import { AuthError, AuthService } from "./services/authService";
import { LanguageSupportManager } from "./services/languageSupportManager";
import { SubmissionTransport } from "./services/submissionTransport";
import { WorkspaceManager } from "./services/workspaceManager";
import { solutionFileName } from "./utils/slug";
import { acceleratorOptions, compatibleGpus } from "./utils/accelerators";
import { redactSecrets } from "./utils/redact";

const SELECTED_LANGUAGE_KEY = "leetgpu.selectedLanguage";
const SELECTED_ACCELERATOR_KEY = "leetgpu.selectedAccelerator";

interface AcceleratorQuickPickItem extends vscode.QuickPickItem {
  accelerator: string;
  unavailableReason?: string;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const log = vscode.window.createOutputChannel("LeetGPU Log", { log: true });
  const auth = new AuthService(context.secrets);
  const api = new LeetGpuClient(auth);
  const workspace = new WorkspaceManager(context);
  const languageSupport = new LanguageSupportManager(context, log);
  const languageFeatures = new LeetGpuLanguageFeatures(workspace);
  const transport = new SubmissionTransport();
  const tree = new ChallengeTreeProvider(api, auth);
  const consoleView = new ConsoleViewProvider(context.extensionUri);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = "leetgpu.selectAccelerator";
  const solutionCodeLens = new SolutionCodeLensProvider(workspace, selectedAccelerator);
  let currentChallenge: ChallengeDetail | undefined;
  let runFinished = true;

  const problem = new ProblemPanel(context.extensionUri, {
    openLanguage: async (language) => {
      if (!currentChallenge) throw new Error("No LeetGPU challenge is open.");
      await openSolutionFile(currentChallenge, language);
    },
    selectAccelerator: async (language) => selectAccelerator(language),
    run: async (action) => runOrSubmit(action),
    loadSubmissions: async (language) => {
      if (!currentChallenge) throw new Error("No LeetGPU challenge is open.");
      ensureConnected(await auth.isConnected());
      return api.getSubmissions(currentChallenge.id, language, await compatibleAccelerator(language));
    },
    loadLeaderboard: async (language) => {
      if (!currentChallenge) throw new Error("No LeetGPU challenge is open.");
      ensureConnected(await auth.isConnected());
      return api.getChallengeLeaderboard(currentChallenge.id, language, await compatibleAccelerator(language));
    },
    openSubmission: async (submissionId) => openSubmissionCode(submissionId)
  });

  const register = (command: string, callback: (...args: any[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(command, async (...args: any[]) => {
      try {
        return await callback(...args);
      } catch (error) {
        const message = safeMessage(error);
        log.error(message);
        await vscode.window.showErrorMessage(message);
        return undefined;
      }
    }));

  context.subscriptions.push(
    log,
    auth,
    languageSupport,
    { dispose: () => transport.dispose() },
    problem,
    solutionCodeLens,
    status,
    vscode.window.registerTreeDataProvider("leetgpu.challenges", tree),
    vscode.window.registerWebviewViewProvider("leetgpu.console", consoleView, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.languages.registerCodeLensProvider(
      [{ language: "cuda" }, { language: "python" }, { language: "mojo" }, { scheme: "file" }, { scheme: "vscode-remote" }],
      solutionCodeLens
    ),
    vscode.languages.registerCompletionItemProvider(
      [{ scheme: "file" }, { scheme: "vscode-remote" }],
      languageFeatures,
      ".",
      "<"
    ),
    vscode.languages.registerHoverProvider(
      [{ scheme: "file" }, { scheme: "vscode-remote" }],
      languageFeatures
    ),
    vscode.languages.registerSignatureHelpProvider(
      [{ scheme: "file" }, { scheme: "vscode-remote" }],
      languageFeatures,
      "(",
      ","
    ),
    vscode.window.onDidChangeActiveTextEditor(() => void updateEditorContext()),
    vscode.workspace.onDidOpenTextDocument((document) => {
      void ensureLanguageSupport(document).catch((error) => log.warn(safeMessage(error)));
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("leetgpu.defaultAccelerator")) void updateEditorContext();
      void languageSupport.handleConfigurationChange(event).catch((error) => log.warn(safeMessage(error)));
      if (event.affectsConfiguration("leetgpu.languageSupport.enabled") && vscode.window.activeTextEditor) {
        void ensureLanguageSupport(vscode.window.activeTextEditor.document).catch((error) => log.warn(safeMessage(error)));
      }
    })
  );

  register("leetgpu.refreshChallenges", async () => withProgress("Refreshing LeetGPU challenges…", async () => {
    await tree.refresh();
  }));
  register("leetgpu.findChallenge", async () => {
    const challenge = await tree.findChallenge();
    if (challenge) await openChallenge(challenge);
  });
  register("leetgpu.openChallenge", async (challenge?: ChallengeSummary) => {
    const selected = challenge ?? await tree.findChallenge();
    if (selected) await openChallenge(selected);
  });
  register("leetgpu.importSession", importSession);
  register("leetgpu.disconnect", disconnect);
  register("leetgpu.run", () => runOrSubmit("run"));
  register("leetgpu.submit", () => runOrSubmit("submit"));
  register("leetgpu.cancel", cancelActiveRun);
  register("leetgpu.selectAccelerator", selectAccelerator);
  register("leetgpu.showSubmissions", () => showCurrentTab("submissions"));
  register("leetgpu.showLeaderboard", () => showCurrentTab("leaderboard"));
  register("leetgpu.showGlobalLeaderboard", showGlobalLeaderboard);
  register("leetgpu.resetSolution", resetSolution);
  register("leetgpu.rebuildLanguageSupport", async () => {
    await languageSupport.rebuild(vscode.window.activeTextEditor?.document.uri);
    vscode.window.showInformationMessage("LeetGPU language support rebuilt.");
  });

  await updateEditorContext();
  if (vscode.window.activeTextEditor) {
    await ensureLanguageSupport(vscode.window.activeTextEditor.document).catch((error) => log.warn(safeMessage(error)));
  }
  void tree.refresh().catch((error) => log.warn(safeMessage(error)));

  async function openChallenge(summary: ChallengeSummary): Promise<void> {
    await withProgress(`Opening ${summary.title}…`, async () => {
      const detail = await api.getChallenge(summary.id);
      currentChallenge = detail;
      const preferred = context.workspaceState.get<string>(SELECTED_LANGUAGE_KEY);
      const opened = await workspace.openChallenge(detail, preferred);
      await languageSupport.ensureForSolution(opened.uri, opened.language);
      await context.workspaceState.update(SELECTED_LANGUAGE_KEY, opened.language);
      const accelerator = await compatibleAccelerator(opened.language);
      problem.show(detail, opened.language, accelerator);
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(opened.uri), {
        viewColumn: vscode.ViewColumn.Two,
        preserveFocus: false,
        preview: false
      });
    });
  }

  async function openSolutionFile(challenge: ChallengeDetail, language: string): Promise<void> {
    const opened = await workspace.openChallenge(challenge, language);
    await languageSupport.ensureForSolution(opened.uri, opened.language);
    await context.workspaceState.update(SELECTED_LANGUAGE_KEY, opened.language);
    await compatibleAccelerator(opened.language);
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(opened.uri), {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: false,
      preview: false
    });
  }

  async function importSession(): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      "Use a private browser window to sign in at leetgpu.com. In Developer Tools → Application/Storage → Local Storage, copy refresh_token from the sb-…-auth-token value. Close the private window without signing out, then continue. Never paste this token into chat, issues, or logs.",
      { modal: true },
      "Paste Token",
      "Open LeetGPU"
    );
    if (choice === "Open LeetGPU") {
      await vscode.env.openExternal(vscode.Uri.parse("https://leetgpu.com/"));
      return;
    }
    if (choice !== "Paste Token") return;

    const input = await vscode.window.showInputBox({
      title: "Import LeetGPU refresh token",
      prompt: "Paste a raw refresh_token or the complete Supabase session JSON.",
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => value.trim() ? undefined : "A token is required."
    });
    if (!input) return;

    await withProgress("Validating LeetGPU session…", async () => {
      const user = await auth.importSession(input);
      await tree.refresh();
      const clear = await vscode.window.showInformationMessage(
        `Connected as ${user.displayName ?? user.email ?? "LeetGPU user"}.`,
        "Clear Clipboard"
      );
      if (clear === "Clear Clipboard") await vscode.env.clipboard.writeText("");
    });
  }

  async function ensureLanguageSupport(document: vscode.TextDocument): Promise<void> {
    const active = await workspace.getActiveSolution(document);
    if (active) await languageSupport.ensureForSolution(document.uri, active.language);
  }

  async function disconnect(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      "Disconnect this VS Code extension? This only removes the local encrypted session and does not sign you out of leetgpu.com.",
      { modal: true },
      "Disconnect"
    );
    if (confirmed !== "Disconnect") return;
    await auth.disconnect();
    const active = await workspace.getActiveSolution();
    if (active) {
      await compatibleAccelerator(active.language).catch((error) => {
        log.warn(`Could not refresh accelerator access after disconnecting: ${safeMessage(error)}`);
      });
    }
    tree.invalidate();
    vscode.window.showInformationMessage("LeetGPU session removed from VS Code.");
  }

  async function runOrSubmit(action: "run" | "submit"): Promise<void> {
    if (transport.active) {
      vscode.window.showWarningMessage("A LeetGPU run is already active.");
      return;
    }
    const document = vscode.window.activeTextEditor?.document;
    const active = await workspace.getActiveSolution(document);
    if (!active || !document) {
      throw new Error("Open a LeetGPU solution file before running or submitting.");
    }
    if (!(await auth.isConnected())) {
      await vscode.commands.executeCommand("leetgpu.importSession");
      if (!(await auth.isConnected())) return;
    }

    const [accessToken, user, accelerator] = await Promise.all([
      auth.getAccessToken(),
      auth.getUser(),
      compatibleAccelerator(active.language)
    ]);
    if (!user) throw new AuthError("The LeetGPU session does not contain a user.");
    const visibility = vscode.workspace.getConfiguration("leetgpu", active.uri).get<"private" | "public">(
      "submissionVisibility",
      "private"
    );
    const payload: SubmissionPayload = {
      files: [{ name: solutionFileName(active.language), content: document.getText() }],
      language: active.language,
      accelerator,
      mode: "accelerated",
      challengeId: active.challengeId,
      userId: user.id,
      public: visibility === "public"
    };

    consoleView.clear();
    consoleView.reveal();
    consoleView.write(`${action === "run" ? "Running" : "Submitting"} ${active.title} · ${active.language} · ${accelerator}\n`);
    setRunning(true, action === "run" ? "Running…" : "Submitting…");
    runFinished = false;

    transport.start(payload, action, accessToken, {
      onEvent: (event) => handleSubmissionEvent(event, action),
      onError: (error) => {
        consoleView.write(`${error.message}\n`, "stderr");
        finishRun();
      },
      onClose: (abnormal) => {
        if (abnormal && !runFinished) {
          consoleView.write("Connection closed before a final status was received. Refresh submissions to determine the result.\n", "stderr");
        }
        finishRun();
      }
    });
  }

  function handleSubmissionEvent(event: SubmissionEvent, action: "run" | "submit"): void {
    if (typeof event.output === "string") {
      consoleView.write(event.output, event.type === "stderr" ? "stderr" : "stdout");
    } else if (event.status) {
      consoleView.write(`[${event.status}]\n`, event.status === "error" ? "stderr" : "stdout");
    }
    if (event.status && ["success", "test-case-failed", "timeout", "out-of-memory", "interrupted", "output-exceeded", "error"].includes(event.status)) {
      finishRun(event.status);
      if (action === "submit") {
        problem.notifySubmissionComplete();
        void tree.refresh().catch((error) => log.warn(safeMessage(error)));
      }
    }
  }

  function finishRun(statusLabel?: string): void {
    if (runFinished) return;
    runFinished = true;
    setRunning(false, statusLabel ? `Finished: ${statusLabel}` : "Ready");
  }

  function cancelActiveRun(): void {
    if (transport.cancel()) consoleView.write("Cancellation requested…\n");
    else vscode.window.showInformationMessage("No LeetGPU run is active.");
  }

  async function selectAccelerator(languageOverride?: string): Promise<void> {
    const active = languageOverride ? undefined : await workspace.getActiveSolution();
    const language = languageOverride
      ?? active?.language
      ?? context.workspaceState.get<string>(SELECTED_LANGUAGE_KEY)
      ?? "cuda";
    const [response, hasPaidAccess] = await Promise.all([
      api.getAccelerators(),
      hasPaidAcceleratorAccess()
    ]);
    const options = acceleratorOptions(
      response.accelerators,
      response.supportedLanguages,
      language,
      hasPaidAccess
    );
    const compatible = options.filter((option) => option.compatible);
    if (!compatible.length) throw new Error(`No LeetGPU accelerator supports ${language}.`);
    const current = selectedAccelerator();
    const items: AcceleratorQuickPickItem[] = options.map((option) => ({
      label: option.name,
      accelerator: option.name,
      unavailableReason: option.unavailableReason,
      description: option.compatible ? option.name === current ? "Current" : undefined : "Unavailable",
      detail: option.unavailableReason,
      iconPath: new vscode.ThemeIcon(
        option.compatible ? option.name === current ? "check" : "server-environment" : "circle-slash"
      )
    }));
    const pickedAccelerator = await showAcceleratorQuickPick(items, language);
    if (!pickedAccelerator) return;
    await context.globalState.update(SELECTED_ACCELERATOR_KEY, pickedAccelerator);
    problem.updateAccelerator(pickedAccelerator);
    solutionCodeLens.refresh();
    await updateEditorContext();
  }

  async function compatibleAccelerator(language: string): Promise<string> {
    const [response, hasPaidAccess] = await Promise.all([
      api.getAccelerators(),
      hasPaidAcceleratorAccess()
    ]);
    const compatible = compatibleGpus(
      response.accelerators,
      response.supportedLanguages,
      language,
      hasPaidAccess
    );
    if (!compatible.length) throw new Error(`No LeetGPU accelerator supports ${language}.`);
    const preferred = selectedAccelerator();
    const selected = compatible.includes(preferred) ? preferred : compatible[0]!;
    if (selected !== preferred) await context.globalState.update(SELECTED_ACCELERATOR_KEY, selected);
    problem.updateAccelerator(selected);
    solutionCodeLens.refresh();
    return selected;
  }

  function showAcceleratorQuickPick(
    items: AcceleratorQuickPickItem[],
    language: string
  ): Promise<string | undefined> {
    const title = `Select a LeetGPU accelerator for ${language}`;
    const defaultPlaceholder = "Unavailable accelerators are visible but cannot be selected.";
    return new Promise((resolve) => {
      const quickPick = vscode.window.createQuickPick<AcceleratorQuickPickItem>();
      let finished = false;
      quickPick.items = items;
      quickPick.title = title;
      quickPick.placeholder = defaultPlaceholder;
      quickPick.matchOnDescription = true;
      quickPick.matchOnDetail = true;
      quickPick.ignoreFocusOut = true;

      const finish = (accelerator?: string): void => {
        if (finished) return;
        finished = true;
        resolve(accelerator);
        quickPick.hide();
        quickPick.dispose();
      };

      quickPick.onDidChangeActive((activeItems) => {
        quickPick.title = title;
        quickPick.placeholder = activeItems[0]?.unavailableReason ?? defaultPlaceholder;
      });
      quickPick.onDidAccept(() => {
        const item = quickPick.selectedItems[0] ?? quickPick.activeItems[0];
        if (!item) return;
        if (item.unavailableReason) {
          quickPick.title = `${item.label} is unavailable — ${item.unavailableReason}`;
          return;
        }
        finish(item.accelerator);
      });
      quickPick.onDidHide(() => finish());
      quickPick.show();
    });
  }

  function selectedAccelerator(): string {
    return context.globalState.get<string>(SELECTED_ACCELERATOR_KEY)
      ?? vscode.workspace.getConfiguration("leetgpu").get<string>("defaultAccelerator", "T4");
  }

  async function hasPaidAcceleratorAccess(): Promise<boolean> {
    if (!(await auth.isConnected())) return false;
    try {
      return await api.hasActiveSubscription();
    } catch (error) {
      log.warn(`Could not determine LeetGPU subscription status: ${safeMessage(error)}`);
      return false;
    }
  }

  async function showCurrentTab(tab: "submissions" | "leaderboard"): Promise<void> {
    const active = await workspace.getActiveSolution();
    if (!active) throw new Error("Open a LeetGPU solution first.");
    if (!currentChallenge || currentChallenge.id !== active.challengeId) {
      currentChallenge = await api.getChallenge(active.challengeId);
      problem.show(currentChallenge, active.language, await compatibleAccelerator(active.language));
    }
    problem.showTab(tab);
  }

  async function showGlobalLeaderboard(): Promise<void> {
    const languages = Object.entries(SUPPORTED_LANGUAGE_LABELS);
    const picked = await vscode.window.showQuickPick(
      languages.map(([id, label]) => ({ label, id })),
      { title: "Global LeetGPU leaderboard language" }
    );
    if (!picked) return;
    const data = await withProgress("Loading global leaderboard…", () => api.getGlobalLeaderboard(picked.id));
    showGlobalLeaderboardPanel(picked.label, data);
  }

  async function openSubmissionCode(submissionId: string): Promise<void> {
    const data = await api.getSubmissionCode(submissionId) as { files?: Array<{ name?: unknown; content?: unknown }> };
    const file = data.files?.find((candidate) => typeof candidate.content === "string");
    if (!file || typeof file.content !== "string") throw new Error("The submission does not contain readable code.");
    const language = languageIdForFile(typeof file.name === "string" ? file.name : "solution.txt");
    const document = await vscode.workspace.openTextDocument({ content: file.content, language });
    await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Two, preview: true });
  }

  async function resetSolution(): Promise<void> {
    const active = await workspace.getActiveSolution();
    if (!active) throw new Error("Open a LeetGPU solution first.");
    const confirmed = await vscode.window.showWarningMessage(
      `Replace the current ${active.language} solution with the latest starter template? This cannot be undone by the extension.`,
      { modal: true },
      "Reset Solution"
    );
    if (confirmed !== "Reset Solution") return;
    const challenge = currentChallenge?.id === active.challengeId
      ? currentChallenge
      : await api.getChallenge(active.challengeId);
    const uri = await workspace.resetSolution(challenge, active.language);
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri), { viewColumn: vscode.ViewColumn.Two });
  }

  async function updateEditorContext(): Promise<void> {
    const active = await workspace.getActiveSolution();
    await vscode.commands.executeCommand("setContext", "leetgpu.activeSolution", Boolean(active));
    solutionCodeLens.refresh();
    if (active) {
      status.text = `$(server-environment) LeetGPU: ${selectedAccelerator()}`;
      status.tooltip = `${active.title} · ${active.language}`;
      status.show();
    } else {
      status.hide();
    }
  }

  function setRunning(running: boolean, label?: string): void {
    void vscode.commands.executeCommand("setContext", "leetgpu.running", running);
    consoleView.setRunning(running, label);
  }

  async function withProgress<T>(title: string, task: () => Promise<T>): Promise<T> {
    try {
      return await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title, cancellable: false },
        task
      );
    } catch (error) {
      const message = safeMessage(error);
      log.error(message);
      throw error;
    }
  }
}

export function deactivate(): void {}

function ensureConnected(connected: boolean): void {
  if (!connected) throw new AuthError("Import a LeetGPU session before using this feature.", 401);
}

function safeMessage(error: unknown): string {
  if (error instanceof AuthError) return `LeetGPU authentication: ${error.message}`;
  if (error instanceof Error) return redactSecrets(error.message);
  return "LeetGPU operation failed.";
}

function languageIdForFile(name: string): string {
  if (name.endsWith(".cu")) return "cuda-cpp";
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".mojo")) return "mojo";
  return "plaintext";
}
