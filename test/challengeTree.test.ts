import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  EventEmitter: class {
    public readonly event = vi.fn();
    public fire(): void {}
  },
  ThemeColor: class {
    public constructor(public readonly id: string) {}
  },
  ThemeIcon: class {
    public constructor(public readonly id: string, public readonly color?: { id: string }) {}
  },
  TreeItem: class {
    public id?: string;
    public iconPath?: unknown;
    public constructor(public readonly label: string, public readonly collapsibleState: number) {}
  },
  TreeItemCollapsibleState: { None: 0, Expanded: 2 }
}));

import type { ChallengeSummary } from "../src/models";
import { ChallengeTreeProvider } from "../src/providers/challengeTree";
import type { LeetGpuClient } from "../src/services/apiClient";
import type { AuthService } from "../src/services/authService";

const challenge: ChallengeSummary = {
  id: 1,
  title: "Vector Add",
  spec: "",
  difficultyLevel: "easy",
  accessTier: "free"
};

async function challengeProgress(tree: ChallengeTreeProvider): Promise<string | undefined> {
  const roots = await tree.getChildren();
  const difficulty = roots.find((node) => node.kind === "difficulty");
  expect(difficulty).toBeDefined();
  const children = await tree.getChildren(difficulty);
  const node = children.find((child) => child.kind === "challenge");
  return node?.kind === "challenge" ? node.progress : undefined;
}

describe("ChallengeTreeProvider progress", () => {
  it("exposes stable challenge identities and parent nodes for tree selection", async () => {
    const auth = {
      isConnected: vi.fn().mockResolvedValue(false),
      getUser: vi.fn().mockResolvedValue(undefined)
    } as unknown as AuthService;
    const api = {
      getChallenges: vi.fn().mockResolvedValue([challenge])
    } as unknown as LeetGpuClient;
    const tree = new ChallengeTreeProvider(api, auth);

    await tree.refresh();
    const node = tree.getChallengeNode(challenge.id);
    expect(node).toBeDefined();
    expect(tree.getParent(node!)).toMatchObject({ kind: "difficulty", difficulty: "easy" });
    expect(tree.getTreeItem(node!).id).toBe("challenge:1");
  });

  it.each([
    [undefined, "circle-outline", "disabledForeground"],
    ["attempted", "history", "charts.yellow"],
    ["completed", "pass-filled", "charts.green"]
  ])("renders %s progress with the expected icon color", async (progress, icon, color) => {
    const auth = {
      isConnected: vi.fn().mockResolvedValue(true),
      getUser: vi.fn().mockResolvedValue({ id: "user-id" })
    } as unknown as AuthService;
    const api = {
      getChallenges: vi.fn().mockResolvedValue([challenge]),
      getProgress: vi.fn().mockResolvedValue(progress ? { "1": progress } : {})
    } as unknown as LeetGpuClient;
    const tree = new ChallengeTreeProvider(api, auth);

    await tree.refresh();
    const roots = await tree.getChildren();
    const difficulty = roots.find((node) => node.kind === "difficulty");
    expect(difficulty).toBeDefined();
    const children = await tree.getChildren(difficulty);
    const node = children.find((child) => child.kind === "challenge");
    expect(node).toBeDefined();

    expect(tree.getTreeItem(node!).iconPath).toMatchObject({
      id: icon,
      color: { id: color }
    });
  });

  it("renders every challenge as not attempted after progress is cleared", async () => {
    const auth = {
      isConnected: vi.fn().mockResolvedValue(true),
      getUser: vi.fn().mockResolvedValue({ id: "user-id" })
    } as unknown as AuthService;
    const api = {
      getChallenges: vi.fn().mockResolvedValue([challenge]),
      getProgress: vi.fn().mockResolvedValue({ "1": "completed" })
    } as unknown as LeetGpuClient;
    const tree = new ChallengeTreeProvider(api, auth);

    await tree.refresh();
    expect(await challengeProgress(tree)).toBe("completed");

    tree.clearProgress();
    expect(await challengeProgress(tree)).toBeUndefined();
  });

  it("updates only the submitted challenge without reloading the list", async () => {
    const auth = {
      isConnected: vi.fn().mockResolvedValue(true),
      getUser: vi.fn().mockResolvedValue({ id: "user-id" })
    } as unknown as AuthService;
    const getChallenges = vi.fn().mockResolvedValue([challenge]);
    const getProgress = vi.fn().mockResolvedValue({});
    const api = { getChallenges, getProgress } as unknown as LeetGpuClient;
    const tree = new ChallengeTreeProvider(api, auth);

    await tree.refresh();
    tree.updateChallengeProgress(challenge.id, "attempted");

    expect(await challengeProgress(tree)).toBe("attempted");
    expect(getChallenges).toHaveBeenCalledOnce();
    expect(getProgress).toHaveBeenCalledOnce();
  });

  it("does not downgrade a completed challenge after a failed submission", async () => {
    const auth = {
      isConnected: vi.fn().mockResolvedValue(true),
      getUser: vi.fn().mockResolvedValue({ id: "user-id" })
    } as unknown as AuthService;
    const api = {
      getChallenges: vi.fn().mockResolvedValue([challenge]),
      getProgress: vi.fn().mockResolvedValue({ "1": "completed" })
    } as unknown as LeetGpuClient;
    const tree = new ChallengeTreeProvider(api, auth);

    await tree.refresh();
    tree.updateChallengeProgress(challenge.id, "attempted");

    expect(await challengeProgress(tree)).toBe("completed");
  });

  it("does not restore stale progress when a request finishes after sign-out", async () => {
    let resolveProgress!: (progress: Record<string, string>) => void;
    const pendingProgress = new Promise<Record<string, string>>((resolve) => {
      resolveProgress = resolve;
    });
    let connected = true;
    const auth = {
      isConnected: vi.fn().mockImplementation(async () => connected),
      getUser: vi.fn().mockResolvedValue(undefined)
    } as unknown as AuthService;
    const getProgress = vi.fn().mockReturnValue(pendingProgress);
    const api = {
      getChallenges: vi.fn().mockResolvedValue([challenge]),
      getProgress
    } as unknown as LeetGpuClient;
    const tree = new ChallengeTreeProvider(api, auth);

    const refresh = tree.refresh();
    await vi.waitFor(() => expect(getProgress).toHaveBeenCalledOnce());
    connected = false;
    tree.clearProgress();
    resolveProgress({ "1": "completed" });
    await refresh;

    expect(await challengeProgress(tree)).toBeUndefined();
  });
});
