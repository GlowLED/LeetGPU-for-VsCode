import { z } from "zod";

export const challengeSummarySchema = z.object({
  id: z.coerce.number(),
  title: z.string(),
  spec: z.string().nullish().transform((value) => value ?? ""),
  difficultyLevel: z.string().nullish().transform((value) => value ?? "unknown"),
  accessTier: z.string().nullish().transform((value) => value ?? "free")
}).passthrough();

export const starterCodeSchema = z.object({
  language: z.string(),
  fileName: z.string().nullish().transform((value) => value ?? "starter.txt"),
  fileContent: z.string()
}).passthrough();

export const challengeDetailSchema = challengeSummarySchema.extend({
  spec: z.string(),
  starterCode: z.array(starterCodeSchema).default([])
}).passthrough();

export const assemblyResponseSchema = z.object({
  ptx: z.string(),
  sass: z.string()
});

export type ChallengeSummary = z.infer<typeof challengeSummarySchema>;
export type StarterCode = z.infer<typeof starterCodeSchema>;
export type ChallengeDetail = z.infer<typeof challengeDetailSchema>;
export type AssemblyResponse = z.infer<typeof assemblyResponseSchema>;

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export interface AcceleratorResponse {
  accelerators: string[];
  supportedLanguages: Record<string, string[]>;
}

export interface SubmissionFile {
  name: string;
  content: string;
}

export interface SubmissionPayload {
  files: SubmissionFile[];
  language: string;
  accelerator: string;
  mode: "accelerated";
  challengeId: number;
  userId: string;
  public: boolean;
}

export interface SubmissionEvent {
  submissionId?: string;
  status?: string;
  type?: string;
  output?: string;
  [key: string]: unknown;
}

export interface ChallengeManifest {
  schemaVersion: 1;
  challengeId: number;
  title: string;
  slug: string;
  solutions: Record<string, { path: string; starterHash: string }>;
}

export interface ActiveSolution {
  challengeId: number;
  title: string;
  language: string;
  uri: import("vscode").Uri;
  manifestUri: import("vscode").Uri;
}
