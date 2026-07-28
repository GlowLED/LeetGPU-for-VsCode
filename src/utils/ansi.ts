export interface AnsiSegment {
  text: string;
  classes: string[];
}

interface AnsiState {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  strike: boolean;
  foreground?: string;
  background?: string;
}

const COLORS = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

export class AnsiParser {
  private carry = "";
  private state: AnsiState = defaultState();

  public write(chunk: string): AnsiSegment[] {
    const input = this.carry + chunk;
    this.carry = "";
    const segments: AnsiSegment[] = [];
    let cursor = 0;

    while (cursor < input.length) {
      const escapeIndex = input.indexOf("\u001b", cursor);
      if (escapeIndex < 0) {
        this.append(segments, input.slice(cursor));
        break;
      }
      this.append(segments, input.slice(cursor, escapeIndex));
      if (escapeIndex + 1 >= input.length) {
        this.carry = input.slice(escapeIndex);
        break;
      }

      const introducer = input[escapeIndex + 1];
      if (introducer === "[") {
        const finalIndex = findCsiFinal(input, escapeIndex + 2);
        if (finalIndex < 0) {
          this.carry = input.slice(escapeIndex);
          break;
        }
        if (input[finalIndex] === "m") {
          this.applySgr(input.slice(escapeIndex + 2, finalIndex));
        }
        cursor = finalIndex + 1;
        continue;
      }

      if (introducer === "]") {
        const end = findOscEnd(input, escapeIndex + 2);
        if (end < 0) {
          this.carry = input.slice(escapeIndex);
          break;
        }
        cursor = end;
        continue;
      }

      // Ignore other two-character terminal escape sequences.
      cursor = escapeIndex + 2;
    }
    return segments;
  }

  public reset(): void {
    this.carry = "";
    this.state = defaultState();
  }

  private append(segments: AnsiSegment[], text: string): void {
    if (!text) return;
    const classes = styleClasses(this.state);
    const previous = segments.at(-1);
    if (previous && previous.classes.join(" ") === classes.join(" ")) {
      previous.text += text;
    } else {
      segments.push({ text, classes });
    }
  }

  private applySgr(parameters: string): void {
    const codes = parameters === ""
      ? [0]
      : parameters.split(";").map((value) => Number.parseInt(value || "0", 10));
    for (let index = 0; index < codes.length; index += 1) {
      const code = codes[index]!;
      if (code === 0) this.state = defaultState();
      else if (code === 1) this.state.bold = true;
      else if (code === 2) this.state.dim = true;
      else if (code === 3) this.state.italic = true;
      else if (code === 4) this.state.underline = true;
      else if (code === 7) this.state.inverse = true;
      else if (code === 9) this.state.strike = true;
      else if (code === 22) { this.state.bold = false; this.state.dim = false; }
      else if (code === 23) this.state.italic = false;
      else if (code === 24) this.state.underline = false;
      else if (code === 27) this.state.inverse = false;
      else if (code === 29) this.state.strike = false;
      else if (code >= 30 && code <= 37) this.state.foreground = COLORS[code - 30];
      else if (code === 39) this.state.foreground = undefined;
      else if (code >= 40 && code <= 47) this.state.background = COLORS[code - 40];
      else if (code === 49) this.state.background = undefined;
      else if (code >= 90 && code <= 97) this.state.foreground = `bright-${COLORS[code - 90]}`;
      else if (code >= 100 && code <= 107) this.state.background = `bright-${COLORS[code - 100]}`;
      else if ((code === 38 || code === 48) && codes[index + 1] === 5) {
        const color = indexedColor(codes[index + 2]);
        if (code === 38) this.state.foreground = color;
        else this.state.background = color;
        index += 2;
      } else if ((code === 38 || code === 48) && codes[index + 1] === 2) {
        // Truecolor cannot be expressed through the fixed CSP-safe class palette.
        index += 4;
      }
    }
  }
}

function defaultState(): AnsiState {
  return { bold: false, dim: false, italic: false, underline: false, inverse: false, strike: false };
}

function styleClasses(state: AnsiState): string[] {
  const classes: string[] = [];
  if (state.bold) classes.push("ansi-bold");
  if (state.dim) classes.push("ansi-dim");
  if (state.italic) classes.push("ansi-italic");
  if (state.underline) classes.push("ansi-underline");
  if (state.inverse) classes.push("ansi-inverse");
  if (state.strike) classes.push("ansi-strike");
  if (state.foreground) classes.push(`ansi-fg-${state.foreground}`);
  if (state.background) classes.push(`ansi-bg-${state.background}`);
  return classes;
}

function findCsiFinal(input: string, start: number): number {
  for (let index = start; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) return index;
  }
  return -1;
}

function findOscEnd(input: string, start: number): number {
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === "\u0007") return index + 1;
    if (input[index] === "\u001b" && input[index + 1] === "\\") return index + 2;
  }
  return -1;
}

function indexedColor(value: number | undefined): string | undefined {
  if (value === undefined || value < 0 || value > 15) return undefined;
  return value < 8 ? COLORS[value] : `bright-${COLORS[value - 8]}`;
}
