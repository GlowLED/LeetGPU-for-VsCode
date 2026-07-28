import sanitizeHtml from "sanitize-html";

const extraTags = [
  "math", "semantics", "annotation", "mrow", "mi", "mo", "mn", "ms", "mtext",
  "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot", "mtable", "mtr", "mtd"
];

export function sanitizeChallengeSpec(spec: string): string {
  return sanitizeHtml(normalizeKatexText(spec), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, ...extraTags, "img"],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
      span: ["class"],
      annotation: ["encoding"]
    },
    allowedSchemes: ["https"],
    allowedSchemesByTag: { img: ["https", "data"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true)
    },
    disallowedTagsMode: "discard"
  });
}

function normalizeKatexText(value: string): string {
  return value.replace(/\\texttt\{([^{}]*)\}/g, (_match, content: string) => (
    `\\texttt{${content.replace(/(^|[^\\])_/g, "$1\\_")}}`
  ));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
