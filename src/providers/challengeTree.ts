import * as vscode from "vscode";
import { SUPPORTED_LANGUAGE_LABELS } from "../constants";
import type { ChallengeSummary } from "../models";
import type { AuthService } from "../services/authService";
import type { LeetGpuClient } from "../services/apiClient";

type TreeNode = AccountNode | ActionNode | StatusNode | DifficultyNode | ChallengeNode;
interface AccountNode { kind: "account"; label: string; connected: boolean }
interface ActionNode { kind: "action"; label: string; command: string; icon: string }
interface StatusNode { kind: "status"; label: string; description?: string; tooltip?: string; icon: string }
interface DifficultyNode { kind: "difficulty"; difficulty: string; challenges: ChallengeSummary[] }
interface ChallengeNode { kind: "challenge"; challenge: ChallengeSummary; progress?: string }

export class ChallengeTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly changed = new vscode.EventEmitter<TreeNode | undefined>();
  private challenges: ChallengeSummary[] = [];
  private progress: Record<string, string> = {};
  private loaded = false;
  private loading = false;
  private loadError: string | undefined;
  private refreshPromise: Promise<void> | undefined;
  public readonly onDidChangeTreeData = this.changed.event;

  public constructor(private readonly api: LeetGpuClient, private readonly auth: AuthService) {}

  public get snapshot(): readonly ChallengeSummary[] {
    return this.challenges;
  }

  public refresh(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.loading = true;
    this.loadError = undefined;
    this.changed.fire(undefined);

    const operation = this.load().catch((error: unknown) => {
      this.loadError = error instanceof Error ? error.message : "LeetGPU could not load the challenge list.";
      throw error;
    }).finally(() => {
      this.loading = false;
      this.refreshPromise = undefined;
      this.changed.fire(undefined);
    });
    this.refreshPromise = operation;
    return operation;
  }

  private async load(): Promise<void> {
    const [challenges, connected] = await Promise.all([
      this.api.getChallenges(),
      this.auth.isConnected()
    ]);
    this.challenges = challenges;
    this.progress = {};
    if (connected) {
      try {
        this.progress = await this.api.getProgress();
      } catch {
        // Challenge browsing remains available when authenticated progress fails.
      }
    }
    this.loaded = true;
  }

  public invalidate(): void {
    this.changed.fire(undefined);
  }

  public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      if (!this.loaded && !this.loading && !this.loadError) void this.refresh().catch(() => undefined);
      if (this.loading) {
        return [{ kind: "status", label: "Loading challenge list…", icon: "loading~spin" }];
      }
      if (!this.loaded && this.loadError) {
        return [
          {
            kind: "status",
            label: "Challenge list could not be loaded",
            description: "Network request failed",
            tooltip: this.loadError,
            icon: "error"
          },
          {
            kind: "action",
            label: "Retry loading challenges",
            command: "leetgpu.refreshChallenges",
            icon: "refresh"
          }
        ];
      }
      const user = await this.auth.getUser();
      const roots: TreeNode[] = [
        {
          kind: "account",
          label: user?.displayName ?? user?.email ?? "Sign in to LeetGPU",
          connected: Boolean(user)
        },
        { kind: "action", label: "Global Leaderboard", command: "leetgpu.showGlobalLeaderboard", icon: "trophy" }
      ];
      for (const difficulty of ["easy", "medium", "hard", "unknown"]) {
        const challenges = this.challenges.filter(
          (challenge) => challenge.difficultyLevel.toLowerCase() === difficulty
        );
        if (challenges.length) roots.push({ kind: "difficulty", difficulty, challenges });
      }
      return roots;
    }
    if (element.kind === "difficulty") {
      return element.challenges.map((challenge) => ({
        kind: "challenge",
        challenge,
        progress: this.progress[String(challenge.id)]
      }));
    }
    return [];
  }

  public getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.kind === "account") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon(element.connected ? "account" : "sign-in");
      item.description = element.connected ? "Connected" : "Run, Submit & history";
      item.tooltip = element.connected
        ? "Connected to LeetGPU. Click to disconnect."
        : "Sign-in is optional for browsing, but required for Run, Submit, Submissions, and Solutions.";
      item.command = {
        command: element.connected ? "leetgpu.disconnect" : "leetgpu.signIn",
        title: element.connected ? "Disconnect" : "Sign In"
      };
      return item;
    }
    if (element.kind === "status") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.description = element.description;
      item.tooltip = element.tooltip ?? element.label;
      item.iconPath = new vscode.ThemeIcon(element.icon);
      return item;
    }
    if (element.kind === "action") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon(element.icon);
      item.command = { command: element.command, title: element.label };
      return item;
    }
    if (element.kind === "difficulty") {
      const item = new vscode.TreeItem(
        `${capitalize(element.difficulty)} (${element.challenges.length})`,
        vscode.TreeItemCollapsibleState.Expanded
      );
      item.iconPath = new vscode.ThemeIcon(difficultyIcon(element.difficulty));
      return item;
    }
    const item = new vscode.TreeItem(
      `${element.challenge.id}. ${element.challenge.title}`,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = element.progress;
    item.tooltip = `${capitalize(element.challenge.difficultyLevel)} · ${element.challenge.accessTier}`;
    item.iconPath = new vscode.ThemeIcon(
      element.progress === "completed" ? "pass-filled" : element.progress === "attempted" ? "history" : "circle-outline"
    );
    item.contextValue = "leetgpuChallenge";
    item.command = {
      command: "leetgpu.openChallenge",
      title: "Open Challenge",
      arguments: [element.challenge]
    };
    return item;
  }

  public async findChallenge(): Promise<ChallengeSummary | undefined> {
    if (!this.loaded) await this.refresh();
    const picked = await vscode.window.showQuickPick(
      this.challenges.map((challenge) => ({
        label: `${challenge.id}. ${challenge.title}`,
        description: `${capitalize(challenge.difficultyLevel)} · ${this.progress[String(challenge.id)] ?? "not attempted"}`,
        detail: Object.keys(SUPPORTED_LANGUAGE_LABELS).join(", "),
        challenge
      })),
      { title: "Find a LeetGPU challenge", matchOnDescription: true }
    );
    return picked?.challenge;
  }
}

function difficultyIcon(difficulty: string): string {
  if (difficulty === "easy") return "symbol-event";
  if (difficulty === "medium") return "symbol-method";
  if (difficulty === "hard") return "flame";
  return "question";
}

function capitalize(value: string): string {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value;
}
