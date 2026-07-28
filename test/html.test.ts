import { describe, expect, it } from "vitest";
import katex from "katex";
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

  it("normalizes underscores inside KaTeX text commands", () => {
    const output = sanitizeChallengeSpec(
      String.raw`<li>\(t_i = \texttt{draft_tokens}[b, i]\) and \(\text{output_tokens} = [1, 2, 0]\) and \(r = \texttt{already\_escaped}\)</li>`
    );
    expect(output).toContain(String.raw`\(t_i = \texttt{draft\_tokens}[b, i]\)`);
    expect(output).toContain(String.raw`\(\text{output\_tokens} = [1, 2, 0]\)`);
    expect(output).toContain(String.raw`\texttt{already\_escaped}`);
  });

  it("produces valid KaTeX for challenge 87 tensor examples", () => {
    const formulas = [
      String.raw`\text{draft_tokens} = [1, 2, 0]`,
      String.raw`\text{uniform_samples} = \begin{bmatrix} 0.50 & 0.70 & 0.30 & 0.90 \end{bmatrix}`,
      String.raw`\text{output_tokens} = \begin{bmatrix} 1 & 3 & 0 & 0 \end{bmatrix}`
    ];
    for (const formula of formulas) {
      const sanitized = sanitizeChallengeSpec(String.raw`\[${formula}\]`);
      const normalized = sanitized.slice(2, -2).replaceAll("&amp;", "&");
      expect(() => katex.renderToString(normalized, { throwOnError: true, displayMode: true })).not.toThrow();
    }
  });

  it("keeps safe inline SVG diagrams and strips active SVG content", () => {
    const output = sanitizeChallengeSpec(
      '<svg width="420" height="180" viewBox="0 0 420 180" style="display:block" onload="steal()">'
      + '<defs><marker id="arrow" markerWidth="8" markerHeight="8"><path d="M0,0 L8,4 L0,8 Z" fill="#fff"></path></marker></defs>'
      + '<rect x="10" y="10" width="80" height="40" fill="#222"></rect>'
      + '<line x1="90" y1="30" x2="180" y2="30" stroke="#44aa66" marker-end="url(#arrow)"></line>'
      + '<text x="20" y="35" fill="#ccc">Input</text>'
      + '<script>alert(1)</script><foreignObject><img src="https://example.com/tracker.png"></foreignObject>'
      + '</svg>'
    );
    expect(output).toContain('<svg width="420" height="180" viewBox="0 0 420 180">');
    expect(output).toContain('<rect x="10" y="10" width="80" height="40" fill="#222"></rect>');
    expect(output).toContain('marker-end="url(#arrow)"');
    expect(output).toContain('<text x="20" y="35" fill="#ccc">Input</text>');
    expect(output).not.toContain("style=");
    expect(output).not.toContain("onload");
    expect(output).not.toContain("script");
    expect(output).not.toContain("foreignObject");
    expect(output).not.toContain("tracker.png");
  });

  it("rejects external SVG paint references", () => {
    const output = sanitizeChallengeSpec(
      '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" fill="url(https://evil.example/a.svg)" marker-end="url(https://evil.example/a.svg#x)"></path></svg>'
    );
    expect(output).not.toContain("evil.example");
    expect(output).not.toContain("marker-end");
    expect(output).not.toContain("fill=");
  });
});
