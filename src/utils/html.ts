import sanitizeHtml from "sanitize-html";

const mathTags = [
  "math", "semantics", "annotation", "mrow", "mi", "mo", "mn", "ms", "mtext",
  "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot", "mtable", "mtr", "mtd"
];
const svgTags = ["svg", "g", "defs", "marker", "path", "rect", "circle", "line", "polygon", "text"];
const svgAttributes = [
  "cx", "cy", "d", "fill", "fill-opacity", "font-family", "font-size", "font-style",
  "font-weight", "height", "id", "marker-end", "markerHeight", "markerWidth", "opacity",
  "orient", "points", "r", "refX", "refY", "rx", "stroke", "stroke-dasharray",
  "stroke-opacity", "stroke-width", "text-anchor", "transform", "viewBox", "width", "x",
  "x1", "x2", "xmlns", "y", "y1", "y2"
];

export function sanitizeChallengeSpec(spec: string): string {
  return sanitizeHtml(normalizeKatexText(spec), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, ...mathTags, ...svgTags, "img"],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
      span: ["class"],
      annotation: ["encoding"],
      ...Object.fromEntries(svgTags.map((tag) => [tag, svgAttributes]))
    },
    allowedSchemes: ["https"],
    allowedSchemesByTag: { img: ["https", "data"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
      ...Object.fromEntries(svgTags.map((tag) => [tag, sanitizeSvgTag]))
    },
    parser: { lowerCaseAttributeNames: false },
    nonTextTags: ["script", "style", "textarea", "option", "foreignobject"],
    disallowedTagsMode: "discard"
  });
}

function sanitizeSvgTag(tagName: string, attributes: Record<string, string>): sanitizeHtml.Tag {
  const safeAttributes = { ...attributes };
  for (const attribute of ["fill", "stroke"]) {
    const value = safeAttributes[attribute];
    if (value && !/^(?:none|currentColor|#[0-9a-f]{3,8})$/i.test(value)) delete safeAttributes[attribute];
  }
  const markerEnd = safeAttributes["marker-end"];
  if (markerEnd && !/^url\(#[A-Za-z][\w:.-]*\)$/.test(markerEnd)) delete safeAttributes["marker-end"];
  return { tagName, attribs: safeAttributes };
}

function normalizeKatexText(value: string): string {
  return value.replace(/\\(text(?:tt|rm|sf|bf|it|normal)?)\{([^{}]*)\}/g, (_match, command: string, content: string) => (
    `\\${command}{${content.replace(/(^|[^\\])_/g, "$1\\_")}}`
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
