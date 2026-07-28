import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { FINAL_SUBMISSION_STATUSES, WS_API_URL } from "../constants";
import type { SubmissionEvent, SubmissionPayload } from "../models";

export interface SubmissionCallbacks {
  onEvent(event: SubmissionEvent): void;
  onError(error: Error): void;
  onClose(abnormal: boolean): void;
}

export class SubmissionTransport {
  private socket: WebSocket | undefined;
  private submissionId: string | undefined;

  public get active(): boolean {
    return Boolean(this.socket && this.socket.readyState < WebSocket.CLOSING);
  }

  public start(
    payload: SubmissionPayload,
    action: "run" | "submit",
    accessToken: string,
    callbacks: SubmissionCallbacks
  ): string {
    if (this.active) {
      throw new Error("A LeetGPU run is already active.");
    }

    const submissionId = randomUUID();
    const socket = new WebSocket(`${WS_API_URL}/api/v1/ws/submit`);
    this.socket = socket;
    this.submissionId = submissionId;
    let reachedFinalState = false;

    socket.on("open", () => {
      socket.send(JSON.stringify({ token: accessToken, submissionId, action, submission: payload }));
    });
    socket.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as SubmissionEvent;
        callbacks.onEvent(parsed);
        if (parsed.status && FINAL_SUBMISSION_STATUSES.has(parsed.status)) {
          reachedFinalState = true;
          socket.close(1000);
        }
      } catch {
        callbacks.onError(new Error("LeetGPU returned an invalid WebSocket event."));
      }
    });
    socket.on("error", () => {
      callbacks.onError(new Error("The LeetGPU WebSocket connection failed."));
    });
    socket.on("close", (code) => {
      this.socket = undefined;
      this.submissionId = undefined;
      callbacks.onClose(code !== 1000 && !reachedFinalState);
    });
    return submissionId;
  }

  public cancel(): boolean {
    if (!this.socket || !this.submissionId) {
      return false;
    }
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ submissionId: this.submissionId, action: "kill" }));
      return true;
    }
    this.socket.close();
    return true;
  }

  public dispose(): void {
    this.socket?.close();
    this.socket = undefined;
    this.submissionId = undefined;
  }
}
