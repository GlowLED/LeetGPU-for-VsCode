import { describe, expect, it } from "vitest";
import { escapeHtml, sanitizeChallengeSpec } from "../src/utils/html";

describe("challenge HTML", () => {
  it("keeps problem formatting while removing active content", () => {
    const output = sanitizeChallengeSpec(
      '<h2>Example</h2><script>alert(1)</script><img src="https://example.com/a.png" onerror="steal()"><a href="javascript:steal()">bad</a>'
    );
    expect(output).toContain("<h2>Example</h2>");
    expect(output).toContain("https://example.com/a.png");
    expect(output).not.toContain("script");
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("javascript:");
  });

  it("escapes table and title values", () => {
    expect(escapeHtml('<img src=x onerror="x">')).toBe("&lt;img src=x onerror=&quot;x&quot;&gt;");
  });

  it("normalizes underscores inside KaTeX texttt commands", () => {
    const output = sanitizeChallengeSpec(
      String.raw`<li>\(t_i = \texttt{draft_tokens}[b, i]\) and \(r = \texttt{already\_escaped}\)</li>`
    );
    expect(output).toContain(String.raw`\(t_i = \texttt{draft\_tokens}[b, i]\)`);
    expect(output).toContain(String.raw`\texttt{already\_escaped}`);
  });
});
