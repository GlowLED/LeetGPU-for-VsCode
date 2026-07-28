import { describe, expect, it } from "vitest";
import { AnsiParser } from "../src/utils/ansi";

describe("ANSI output parser", () => {
  it("renders color spans and removes SGR control sequences", () => {
    const parser = new AnsiParser();
    expect(parser.write("\u001b[32m✓ Test passed\u001b[0m\n")).toEqual([
      { text: "✓ Test passed", classes: ["ansi-fg-green"] },
      { text: "\n", classes: [] }
    ]);
  });

  it("preserves formatting across fragmented websocket chunks", () => {
    const parser = new AnsiParser();
    expect(parser.write("\u001b[3")).toEqual([]);
    expect(parser.write("1mfailed")).toEqual([{ text: "failed", classes: ["ansi-fg-red"] }]);
    expect(parser.write(" later\u001b[0m")).toEqual([{ text: " later", classes: ["ansi-fg-red"] }]);
    expect(parser.write(" plain")).toEqual([{ text: " plain", classes: [] }]);
  });

  it("strips unsupported terminal control and OSC sequences", () => {
    const parser = new AnsiParser();
    expect(parser.write("one\u001b[2Ktwo\u001b]0;title\u0007three"))
      .toEqual([{ text: "onetwothree", classes: [] }]);
  });
});
