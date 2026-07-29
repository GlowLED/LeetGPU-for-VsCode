import * as vscode from "vscode";
import { SUPPORTED_LANGUAGE_LABELS } from "./constants";
import type { ChallengeDetail, ChallengeSummary, SubmissionEvent, SubmissionPayload } from "./models";
import { ChallengeTreeProvider } from "./providers/challengeTree";
import { ConsoleViewProvider } from "./providers/consoleView";
import { LeetGpuLanguageFeatures } from "./providers/languageFeatures";
import { ProblemPanel, showGlobalLeaderboardPanel } from "./providers/problemPanel";
import { READ_ONLY_CODE_SCHEME, ReadOnlyCodeProvider } from "./providers/readOnlyCodeProvider";
import { SolutionCodeLensProvider } from "./providers/solutionCodeLens";
import { LeetGpuClient } from "./services/apiClient";
import { AuthError, AuthService } from "./services/authService";
import { BrowserAuthFlowError, BrowserAuthService } from "./services/browserAuthService";
import { LanguageSupportManager } from "./services/languageSupportManager";
import { SubmissionTransport } from "./services/submissionTransport";
import { WorkspaceManager } from "./services/workspaceManager";
import { solutionFileName } from "./utils/slug";
import { acceleratorOptions, compatibleGpus } from "./utils/accelerators";
import { extractRefreshTokenFromJson } from "./utils/authInput";
import type { BrowserAuthProvider } from "./utils/browserAuth";
import {
  CUDA_EDITOR_LANGUAGE_ID,
  editorLanguageIdForFile,
  editorLanguageIdForSolution,
  resolveAvailableEditorLanguage
} from "./utils/editorLanguage";
import { redactSecrets } from "./utils/redact";

const SELECTED_LANGUAGE_KEY = "leetgpu.selectedLanguage";
const SELECTED_ACCELERATOR_KEY = "leetgpu.selectedAccelerator";

interface AcceleratorQuickPickItem extends vscode.QuickPickItem {
  accelerator: string;
  unavailableReason?: string;
}

interface SignInQuickPickItem extends vscode.QuickPickItem {
  action: BrowserAuthProvider | "clipboard" | "manual";
}

interface ActiveChallengeOpen {
  id: number;
  sequence: number;
  controller: AbortController;
}

interface CompatibleAcceleratorOptions {
  signal?: AbortSignal;
  apply?: boolean;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const log = vscode.window.createOutputChannel("LeetGPU Log", { log: true });
  const auth = new AuthService(context.secrets);
  const browserAuth = new BrowserAuthService(
    auth,
    vscode.Uri.joinPath(context.globalStorageUri, "browser-auth-profile").fsPath
  );
  const api = new LeetGpuClient(auth);
  const workspace = new WorkspaceManager(context);
  const languageSupport = new LanguageSupportManager(context, log);
  const languageFeatures = new LeetGpuLanguageFeatures(workspace);
  const transport = new SubmissionTransport();
  const tree = new ChallengeTreeProvider(api, auth);
  const challengeTreeView = vscode.window.createTreeView("leetgpu.challenges", {
    treeDataProvider: tree
  });
  const consoleView = new ConsoleViewProvider(context.extensionUri);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = "leetgpu.selectAccelerator";
  const solutionCodeLens = new SolutionCodeLensProvider(workspace, selectedAccelerator);
  const readOnlyCode = new ReadOnlyCodeProvider();
  const preparingDocuments = new Map<string, Promise<vscode.TextDocument>>();
  let currentChallenge: ChallengeDetail | undefined;
  let challengeOpenSequence = 0;
  let activeChallengeOpen: ActiveChallengeOpen | undefined;
  let runFinished = true;

  const problem = new ProblemPanel(context.extensionUri, {
    openLanguage: async (language) => {
      if (!currentChallenge) throw new Error("No LeetGPU challenge is open.");
      await withProgress(`Switching to ${languageLabel(language)}…`, () =>
        openSolutionFile(currentChallenge!, language)
      );
    },
    selectAccelerator: async (language) => selectAccelerator(language),
    showAssembly: async (language) => {
      if (!currentChallenge) throw new Error("No LeetGPU challenge is open.");
      const opened = await workspace.openChallenge(currentChallenge, language);
      const document = await vscode.workspace.openTextDocument(opened.uri);
      await showAssembly(document, {
        challengeId: currentChallenge.id,
        language: opened.language
      });
    },
    run: async (action, language) => {
      if (!currentChallenge) throw new Error("No LeetGPU challenge is open.");
      await runOrSubmit(action, { challengeId: currentChallenge.id, language });
    },
    loadSubmissions: async (language) => withProgress(
      `Loading ${languageLabel(language)} submissions…`,
      async () => {
        if (!currentChallenge) throw new Error("No LeetGPU challenge is open.");
        ensureConnected(await auth.isConnected());
        return api.getSubmissions(currentChallenge.id, language, await compatibleAccelerator(language));
      }
    ),
    loadSolutions: async (language, page) => withProgress(
      `Loading ${languageLabel(language)} solutions · page ${page}…`,
      async () => {
        if (!currentChallenge) throw new Error("No LeetGPU challenge is open.");
        ensureConnected(await auth.isConnected());
        return api.getSolutions(
          currentChallenge.id,
          language,
          await compatibleAccelerator(language),
          page
        );
      }
    ),
    loadLeaderboard: async (language) => withProgress(
      `Loading ${languageLabel(language)} leaderboard…`,
      async () => {
        if (!currentChallenge) throw new Error("No LeetGPU challenge is open.");
        ensureConnected(await auth.isConnected());
        return api.getChallengeLeaderboard(
          currentChallenge.id,
          language,
          await compatibleAccelerator(language)
        );
      }
    ),
    openSubmission: async (submissionId) => openSubmissionCode(submissionId),
    openSolution: async (solutionId, fileName, content) => {
      await readOnlyCode.show("solution", solutionId, fileName, content, editorLanguageIdForFile(fileName));
    }
  });

  const register = (command: string, callback: (...args: any[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(command, async (...args: any[]) => {
      try {
        return await callback(...args);
      } catch (error) {
        if (error instanceof vscode.CancellationError) return undefined;
        const message = safeMessage(error);
        log.error(message);
        await vscode.window.showErrorMessage(message);
        return undefined;
      }
    }));

  context.subscriptions.push(
    log,
    auth,
    browserAuth,
    languageSupport,
    { dispose: () => transport.dispose() },
    { dispose: () => activeChallengeOpen?.controller.abort(new vscode.CancellationError()) },
    problem,
    solutionCodeLens,
    readOnlyCode,
    status,
    challengeTreeView,
    vscode.workspace.registerTextDocumentContentProvider(READ_ONLY_CODE_SCHEME, readOnlyCode),
    vscode.window.registerWebviewViewProvider("leetgpu.console", consoleView, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.languages.registerCodeLensProvider(
      [{ language: CUDA_EDITOR_LANGUAGE_ID }, { language: "python" }, { language: "mojo" }, { scheme: "file" }, { scheme: "vscode-remote" }],
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
    vscode.extensions.onDidChange(() => {
      void Promise.all(vscode.workspace.textDocuments.map((document) => ensureLanguageSupport(document)))
        .catch((error) => log.warn(safeMessage(error)));
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("leetgpu.defaultAccelerator")) void updateEditorContext();
      void languageSupport.handleConfigurationChange(event).catch((error) => log.warn(safeMessage(error)));
      if (event.affectsConfiguration("leetgpu.languageSupport.enabled") && vscode.window.activeTextEditor) {
        void ensureLanguageSupport(vscode.window.activeTextEditor.document).catch((error) => log.warn(safeMessage(error)));
      }
    })
  );

  register("leetgpu.refreshChallenges", async () => withProgress("Reloading LeetGPU challenge list…", async () => {
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
  register("leetgpu.signIn", signIn);
  register("leetgpu.importSessionFromClipboard", importSessionFromClipboard);
  register("leetgpu.importSession", importSessionManually);
  register("leetgpu.disconnect", disconnect);
  register("leetgpu.resetBrowserSignInProfile", resetBrowserSignInProfile);
  register("leetgpu.run", () => runOrSubmit("run"));
  register("leetgpu.submit", () => runOrSubmit("submit"));
  register("leetgpu.cancel", cancelActiveRun);
  register("leetgpu.selectAccelerator", selectAccelerator);
  register("leetgpu.showAssembly", showAssemblyForActiveSolution);
  register("leetgpu.showSubmissions", () => showCurrentTab("submissions"));
  register("leetgpu.showSolutions", () => showCurrentTab("solutions"));
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
  void tree.refresh()
    .then(() => currentChallenge && revealChallenge(currentChallenge.id))
    .catch((error) => log.warn(safeMessage(error)));

  async function openChallenge(summary: ChallengeSummary): Promise<void> {
    if (activeChallengeOpen?.id === summary.id) {
      await revealChallenge(summary.id);
      return;
    }
    if (currentChallenge?.id === summary.id) {
      challengeOpenSequence += 1;
      const previous = activeChallengeOpen;
      activeChallengeOpen = undefined;
      previous?.controller.abort(new vscode.CancellationError());
      await revealChallenge(summary.id);
      return;
    }

    const sequence = ++challengeOpenSequence;
    const controller = new AbortController();
    const previous = activeChallengeOpen;
    const operation: ActiveChallengeOpen = { id: summary.id, sequence, controller };
    activeChallengeOpen = operation;
    previous?.controller.abort(new vscode.CancellationError());
    const ensureCurrent = () => {
      if (
        controller.signal.aborted
        || activeChallengeOpen !== operation
        || challengeOpenSequence !== sequence
      ) throw new vscode.CancellationError();
    };

    try {
      await withProgress(`Opening ${summary.title}…`, async () => {
        const detail = await api.getChallenge(summary.id, controller.signal);
        ensureCurrent();
        const preferred = context.workspaceState.get<string>(SELECTED_LANGUAGE_KEY);
        const opened = await workspace.openChallenge(detail, preferred);
        ensureCurrent();
        const document = await prepareSolutionDocument(
          await vscode.workspace.openTextDocument(opened.uri),
          opened.language
        );
        ensureCurrent();
        const accelerator = await compatibleAccelerator(opened.language, {
          signal: controller.signal,
          apply: false
        });
        ensureCurrent();
        await context.workspaceState.update(SELECTED_LANGUAGE_KEY, opened.language);
        ensureCurrent();
        if (accelerator !== selectedAccelerator()) {
          await context.globalState.update(SELECTED_ACCELERATOR_KEY, accelerator);
          ensureCurrent();
        }
        currentChallenge = detail;
        problem.show(detail, opened.language, accelerator);
        solutionCodeLens.refresh();
        await vscode.window.showTextDocument(document, {
          viewColumn: vscode.ViewColumn.Two,
          preserveFocus: false,
          preview: false
        });
        ensureCurrent();
        await revealChallenge(summary.id);
      });
    } catch (error) {
      if (controller.signal.aborted || activeChallengeOpen !== operation) return;
      throw error;
    } finally {
      if (activeChallengeOpen === operation) activeChallengeOpen = undefined;
    }
  }

  async function revealChallenge(challengeId: number): Promise<void> {
    const node = tree.getChallengeNode(challengeId);
    if (!node) return;
    await challengeTreeView.reveal(node, { select: true, focus: false });
  }

  async function openSolutionFile(challenge: ChallengeDetail, language: string): Promise<void> {
    const opened = await workspace.openChallenge(challenge, language);
    const document = await prepareSolutionDocument(
      await vscode.workspace.openTextDocument(opened.uri),
      opened.language
    );
    await context.workspaceState.update(SELECTED_LANGUAGE_KEY, opened.language);
    await compatibleAccelerator(opened.language);
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: false,
      preview: false
    });
  }

  async function signIn(): Promise<void> {
    const picked = await vscode.window.showQuickPick<SignInQuickPickItem>([
      {
        label: "$(github) Continue with GitHub",
        description: "Automatic browser sign-in",
        detail: "Uses a dedicated browser profile and imports the LeetGPU session automatically.",
        action: "github"
      },
      {
        label: "$(globe) Continue with Google",
        description: "Automatic browser sign-in",
        detail: "Uses a dedicated browser profile and imports the LeetGPU session automatically.",
        action: "google"
      },
      {
        label: "$(clippy) Import copied browser session",
        description: "Fallback",
        detail: "Copy the complete sb-…-auth-token value; the extension extracts refresh_token from its JSON.",
        action: "clipboard"
      },
      {
        label: "$(key) Paste a refresh token manually",
        description: "Advanced fallback",
        action: "manual"
      }
    ], {
      title: "Sign in to LeetGPU",
      placeHolder: "Continue with the same GitHub or Google account you use on LeetGPU",
      matchOnDescription: true,
      matchOnDetail: true
    });
    if (!picked) return;
    if (picked.action === "clipboard") return importSessionFromClipboard();
    if (picked.action === "manual") return importSessionManually();
    return signInWithBrowser(picked.action);
  }

  async function signInWithBrowser(provider: BrowserAuthProvider): Promise<void> {
    try {
      const user = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Complete LeetGPU ${provider === "github" ? "GitHub" : "Google"} sign-in in the dedicated browser…`,
          cancellable: true
        },
        (_progress, cancellationToken) => browserAuth.signIn(provider, cancellationToken)
      );
      refreshAuthenticatedStateInBackground();
      await vscode.window.showInformationMessage(
        `Connected as ${user.displayName ?? user.email ?? "LeetGPU user"}.`
      );
    } catch (error) {
      if (error instanceof BrowserAuthFlowError && error.reason === "canceled") return;
      const choice = await vscode.window.showWarningMessage(
        `${safeMessage(error)} You can import a browser session instead.`,
        "Import from Clipboard",
        "Paste Manually"
      );
      if (choice === "Import from Clipboard") await importSessionFromClipboard();
      if (choice === "Paste Manually") await importSessionManually();
    }
  }

  async function importSessionFromClipboard(): Promise<void> {
    const input = await vscode.env.clipboard.readText();
    if (!extractRefreshTokenFromJson(input)) {
      const choice = await vscode.window.showInformationMessage(
        "No complete LeetGPU session JSON was found on the clipboard. In a private browser window, sign in to leetgpu.com, open Developer Tools → Application/Storage → Local Storage, right-click the sb-…-auth-token value, and choose Copy value. You do not need to open or edit the JSON.",
        { modal: true },
        "Open LeetGPU",
        "Paste Manually"
      );
      if (choice === "Open LeetGPU") {
        await vscode.env.openExternal(vscode.Uri.parse("https://leetgpu.com/"));
        const ready = await vscode.window.showInformationMessage(
          "After copying the complete sb-…-auth-token value, return to VS Code and read it from the clipboard.",
          "Read Clipboard"
        );
        if (ready === "Read Clipboard") await importSessionFromClipboard();
      } else if (choice === "Paste Manually") {
        await importSessionManually();
      }
      return;
    }

    await importAndConnect(input);
  }

  async function resetBrowserSignInProfile(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      "Reset the dedicated LeetGPU sign-in browser profile? This removes its saved GitHub/Google sign-in state but does not disconnect the session stored in VS Code or affect your regular browser.",
      { modal: true },
      "Reset Profile"
    );
    if (confirmed !== "Reset Profile") return;
    await browserAuth.resetProfile();
    await vscode.window.showInformationMessage("LeetGPU's dedicated browser sign-in profile was reset.");
  }

  async function importSessionManually(): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      "Use a private browser window to sign in at leetgpu.com. In Developer Tools → Application/Storage → Local Storage, copy refresh_token or the complete sb-…-auth-token value. Close the private window without signing out, then continue. Never paste this session into chat, issues, or logs.",
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

    await importAndConnect(input);
  }

  async function importAndConnect(input: string): Promise<void> {
    const user = await withProgress("Validating LeetGPU session…", () => auth.importSession(input));
    refreshAuthenticatedStateInBackground();
    const clear = await vscode.window.showInformationMessage(
      `Connected as ${user.displayName ?? user.email ?? "LeetGPU user"}.`,
      "Clear Clipboard"
    );
    if (clear === "Clear Clipboard") {
      const clipboard = await vscode.env.clipboard.readText();
      if (clipboard === input) await vscode.env.clipboard.writeText("");
    }
  }

  function refreshAuthenticatedStateInBackground(): void {
    tree.invalidate();
    void refreshAuthenticatedState().catch((error) => {
      tree.invalidate();
      log.warn(`Could not refresh state after signing in: ${safeMessage(error)}`);
    });
  }

  async function refreshAuthenticatedState(): Promise<void> {
    const active = await workspace.getActiveSolution();
    const refreshes: Promise<unknown>[] = [
      tree.refresh().catch((error) => {
        tree.invalidate();
        log.warn(`Could not refresh account data after signing in: ${safeMessage(error)}`);
      })
    ];
    if (active) refreshes.push(compatibleAccelerator(active.language).catch((error) => {
      log.warn(`Could not refresh accelerator access after signing in: ${safeMessage(error)}`);
    }));
    await Promise.all(refreshes);
  }

  async function ensureLanguageSupport(document: vscode.TextDocument): Promise<void> {
    const active = await workspace.getActiveSolution(document);
    if (active) await prepareSolutionDocument(document, active.language);
  }

  async function prepareSolutionDocument(
    document: vscode.TextDocument,
    language: string
  ): Promise<vscode.TextDocument> {
    const key = document.uri.toString();
    const pending = preparingDocuments.get(key);
    if (pending) return pending;

    const expectedLanguageId = editorLanguageIdForSolution(language);
    const preparation = (async () => {
      await languageSupport.ensureForSolution(document.uri, language);
      if (!expectedLanguageId) return document;

      const availableLanguages = await vscode.languages.getLanguages();
      const effectiveLanguageId = resolveAvailableEditorLanguage(expectedLanguageId, availableLanguages);
      const currentDocument = vscode.workspace.textDocuments.find(
        (candidate) => candidate.uri.toString() === key
      ) ?? document;
      return currentDocument.languageId === effectiveLanguageId
        ? currentDocument
        : vscode.languages.setTextDocumentLanguage(currentDocument, effectiveLanguageId);
    })();
    preparingDocuments.set(key, preparation);
    try {
      return await preparation;
    } finally {
      if (preparingDocuments.get(key) === preparation) preparingDocuments.delete(key);
    }
  }

  async function disconnect(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      "Disconnect this VS Code extension? This only removes the local encrypted session and does not sign you out of leetgpu.com.",
      { modal: true },
      "Disconnect"
    );
    if (confirmed !== "Disconnect") return;
    await auth.disconnect();
    tree.clearProgress();
    const active = await workspace.getActiveSolution();
    if (active) {
      await compatibleAccelerator(active.language).catch((error) => {
        log.warn(`Could not refresh accelerator access after disconnecting: ${safeMessage(error)}`);
      });
    }
    vscode.window.showInformationMessage("LeetGPU session removed from VS Code.");
  }

  async function runOrSubmit(
    action: "run" | "submit",
    target?: { challengeId: number; language: string }
  ): Promise<void> {
    if (transport.active) {
      vscode.window.showWarningMessage("A LeetGPU run is already active.");
      return;
    }
    let active = target
      ? await workspace.findSolution(target.challengeId, target.language)
      : await workspace.getActiveSolution();
    if (!active && !target && currentChallenge) {
      const selectedLanguage = context.workspaceState.get<string>(SELECTED_LANGUAGE_KEY);
      if (selectedLanguage) {
        active = await workspace.findSolution(currentChallenge.id, selectedLanguage);
      }
    }
    if (!active) {
      if (target) {
        throw new Error(
          `Could not find the ${languageLabel(target.language)} solution for challenge #${target.challengeId}. `
          + "Open that language from the problem panel to recreate the missing file."
        );
      }
      throw new Error("Open a LeetGPU challenge or solution before running or submitting.");
    }
    const document = await vscode.workspace.openTextDocument(active.uri);
    if (!(await auth.isConnected())) {
      await vscode.commands.executeCommand("leetgpu.signIn");
      if (!(await auth.isConnected())) return;
    }

    await consoleView.reveal();
    consoleView.clear();
    consoleView.write(`Preparing ${action === "run" ? "run" : "submission"}…\n`);

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

    consoleView.write(`${action === "run" ? "Running" : "Submitting"} ${active.title} · ${active.language} · ${accelerator}\n`);
    setRunning(true, action === "run" ? "Running…" : "Submitting…");
    runFinished = false;

    transport.start(payload, action, accessToken, {
      onEvent: (event) => handleSubmissionEvent(event, action, active.challengeId),
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

  function handleSubmissionEvent(
    event: SubmissionEvent,
    action: "run" | "submit",
    challengeId: number
  ): void {
    if (typeof event.output === "string") {
      consoleView.write(event.output, event.type === "stderr" ? "stderr" : "stdout");
    } else if (event.status) {
      consoleView.write(`[${event.status}]\n`, event.status === "error" ? "stderr" : "stdout");
    }
    if (event.status && ["success", "test-case-failed", "timeout", "out-of-memory", "interrupted", "output-exceeded", "error"].includes(event.status)) {
      finishRun(event.status);
      if (action === "submit") {
        problem.notifySubmissionComplete();
        tree.updateChallengeProgress(
          challengeId,
          event.status === "success" ? "completed" : "attempted"
        );
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
    const [response, hasPaidAccess] = await withProgress(
      `Loading available accelerators for ${languageLabel(language)}…`,
      () => Promise.all([
        api.getAccelerators(),
        hasPaidAcceleratorAccess()
      ])
    );
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

  async function compatibleAccelerator(
    language: string,
    options: CompatibleAcceleratorOptions = {}
  ): Promise<string> {
    const [response, hasPaidAccess] = await Promise.all([
      api.getAccelerators("accelerated", options.signal),
      hasPaidAcceleratorAccess(options.signal)
    ]);
    throwIfOperationCanceled(options.signal);
    const compatible = compatibleGpus(
      response.accelerators,
      response.supportedLanguages,
      language,
      hasPaidAccess
    );
    if (!compatible.length) throw new Error(`No LeetGPU accelerator supports ${language}.`);
    const preferred = selectedAccelerator();
    const selected = compatible.includes(preferred) ? preferred : compatible[0]!;
    if (options.apply === false) return selected;
    if (selected !== preferred) await context.globalState.update(SELECTED_ACCELERATOR_KEY, selected);
    throwIfOperationCanceled(options.signal);
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

  async function hasPaidAcceleratorAccess(signal?: AbortSignal): Promise<boolean> {
    throwIfOperationCanceled(signal);
    if (!(await auth.isConnected())) return false;
    throwIfOperationCanceled(signal);
    try {
      return await api.hasActiveSubscription(signal);
    } catch (error) {
      throwIfOperationCanceled(signal);
      log.warn(`Could not determine LeetGPU subscription status: ${safeMessage(error)}`);
      return false;
    }
  }

  async function showCurrentTab(tab: "submissions" | "solutions" | "leaderboard"): Promise<void> {
    const active = await workspace.getActiveSolution();
    if (!active) throw new Error("Open a LeetGPU solution first.");
    if (!currentChallenge || currentChallenge.id !== active.challengeId) {
      currentChallenge = await api.getChallenge(active.challengeId);
      problem.show(currentChallenge, active.language, await compatibleAccelerator(active.language));
    }
    await revealChallenge(active.challengeId);
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
    const data = await withProgress(
      "Loading submission code…",
      () => api.getSubmissionCode(submissionId)
    ) as { files?: Array<{ name?: unknown; content?: unknown }> };
    const file = data.files?.find((candidate) => typeof candidate.content === "string");
    if (!file || typeof file.content !== "string") throw new Error("The submission does not contain readable code.");
    const fileName = typeof file.name === "string" ? file.name : "solution.txt";
    await readOnlyCode.show("submission", submissionId, fileName, file.content, editorLanguageIdForFile(fileName));
  }

  async function showAssemblyForActiveSolution(): Promise<void> {
    const document = vscode.window.activeTextEditor?.document;
    const active = await workspace.getActiveSolution(document);
    if (!document || !active) throw new Error("Open a LeetGPU CUDA solution before viewing assembly.");
    await showAssembly(document, active);
  }

  async function showAssembly(
    document: vscode.TextDocument,
    active: { challengeId: number; language: string }
  ): Promise<void> {
    ensureConnected(await auth.isConnected());
    if (active.language !== "cuda") {
      throw new Error("PTX and SASS are currently available only for CUDA solutions.");
    }
    if (transport.active) throw new Error("Wait for the active LeetGPU run to finish before generating assembly.");

    const result = await withCancellableProgress("Generating PTX and SASS…", async (signal) => {
      const accelerator = await compatibleAccelerator("cuda");
      if (signal.aborted) throw new vscode.CancellationError();
      const assembly = await api.generateAssembly(
        [{ name: "solution.cu", content: document.getText() }],
        accelerator,
        signal
      );
      return { assembly, accelerator };
    });
    const previewId = `${active.challengeId}-${result.accelerator}`;
    await readOnlyCode.showMany("assembly", previewId, [
      { fileName: "solution.ptx", content: result.assembly.ptx, languageId: "leetgpu-ptx" },
      { fileName: "solution.sass", content: result.assembly.sass, languageId: "leetgpu-sass" }
    ]);
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
    await Promise.all([
      vscode.commands.executeCommand("setContext", "leetgpu.activeSolution", Boolean(active)),
      vscode.commands.executeCommand("setContext", "leetgpu.activeLanguage", active?.language)
    ]);
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
      if (!(error instanceof vscode.CancellationError)) log.error(safeMessage(error));
      throw error;
    }
  }

  async function withCancellableProgress<T>(
    title: string,
    task: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title, cancellable: true },
      async (_progress, token) => {
        const controller = new AbortController();
        const cancellation = token.onCancellationRequested(() => controller.abort());
        try {
          return await task(controller.signal);
        } catch (error) {
          if (token.isCancellationRequested) throw new vscode.CancellationError();
          log.error(safeMessage(error));
          throw error;
        } finally {
          cancellation.dispose();
        }
      }
    );
  }
}

export function deactivate(): void {}

function ensureConnected(connected: boolean): void {
  if (!connected) throw new AuthError("Sign in to LeetGPU before using this feature.", 401);
}

function throwIfOperationCanceled(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new vscode.CancellationError();
}

function safeMessage(error: unknown): string {
  if (error instanceof AuthError) return `LeetGPU authentication: ${error.message}`;
  if (error instanceof Error) return redactSecrets(error.message);
  return "LeetGPU operation failed.";
}

function languageLabel(language: string): string {
  return SUPPORTED_LANGUAGE_LABELS[language] ?? language;
}
