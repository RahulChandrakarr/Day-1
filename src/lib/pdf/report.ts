import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
// fontkit expects this global when laying out text
import "regenerator-runtime/runtime.js";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

// A4 page, simple flowing layout: headings, text, stat boxes, tables, bars.
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 44;
const CONTENT = PAGE.width - MARGIN * 2;
const FOOTER = 34;

export const COLORS = {
  ink: rgb(0.169, 0.129, 0.09),
  muted: rgb(0.45, 0.41, 0.37),
  faint: rgb(0.88, 0.85, 0.8),
  panel: rgb(0.98, 0.96, 0.93),
  ember: rgb(0.69, 0.337, 0.122),
  moss: rgb(0.298, 0.478, 0.31),
  red: rgb(0.702, 0.216, 0.18),
  white: rgb(1, 1, 1),
};

export type Tone = "good" | "bad" | undefined;
const toneColor = (tone: Tone) =>
  tone === "good" ? COLORS.moss : tone === "bad" ? COLORS.red : COLORS.ink;

type Fonts = { regular: PDFFont; bold: PDFFont; hindi: PDFFont };

const fontDir = path.join(process.cwd(), "src/lib/pdf/fonts");
let fontBytes: Promise<[Buffer, Buffer, Buffer]> | null = null;
const loadFontBytes = () =>
  (fontBytes ??= Promise.all([
    readFile(path.join(fontDir, "NotoSans-Regular.ttf")),
    readFile(path.join(fontDir, "NotoSans-Bold.ttf")),
    readFile(path.join(fontDir, "NotoSansDevanagari-Regular.ttf")),
  ]));

const DEVANAGARI = /[\u{0900}-\u{097F}\u{A8E0}-\u{A8FF}]/u;
// Drawn as shapes, since the fonts have no glyph for them
const SYMBOLS = new Set(["✓", "○", "▲", "▼"]);

type Run = { text: string; kind: "latin" | "hindi" | "symbol" };

// Split text into runs so Hindi uses the Devanagari font
function runs(text: string) {
  const out: Run[] = [];
  for (const char of text) {
    const kind = SYMBOLS.has(char) ? "symbol" : DEVANAGARI.test(char) ? "hindi" : "latin";
    const last = out[out.length - 1];
    // Spaces stay with the run they're in
    if (last && last.kind !== "symbol" && (last.kind === kind || char === " "))
      last.text += char;
    else out.push({ text: char, kind });
  }
  return out;
}

// Characters the fonts can't draw are dropped
const clean = (text: string) =>
  text
    .replace(/[\u{00A0}\u{202F}]/gu, " ")
    .replace(/[\u{200B}-\u{200D}\u{FE0F}]/gu, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{2712}\u{2714}-\u{27BF}]/gu, "")
    .replace(/\t/g, "  ");

export type Column = { label: string; width: number; align?: "left" | "right" };
export type Cell = string | { text: string; tone?: Tone; bold?: boolean };

export class ReportDoc {
  private page!: PDFPage;
  private y = 0;

  private doc: PDFDocument;
  private fonts: Fonts;

  private constructor(doc: PDFDocument, fonts: Fonts) {
    this.doc = doc;
    this.fonts = fonts;
  }

  static async create(title: string, subtitle: string) {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const [regular, bold, hindi] = await loadFontBytes();
    const fonts = {
      regular: await doc.embedFont(regular, { subset: true }),
      bold: await doc.embedFont(bold, { subset: true }),
      hindi: await doc.embedFont(hindi, { subset: true }),
    };
    doc.setTitle(`${title} · ${subtitle}`);
    doc.setAuthor("Day One");
    doc.setCreator("Day One");
    const report = new ReportDoc(doc, fonts);
    report.addPage();
    report.header(title, subtitle);
    return report;
  }

  // ---- low level --------------------------------------------------------
  private addPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER) this.addPage();
  }

  private width(text: string, size: number, bold = false) {
    let total = 0;
    for (const run of runs(clean(text)))
      total +=
        run.kind === "symbol"
          ? size * 0.8
          : this.font(run, bold).widthOfTextAtSize(run.text, size);
    return total;
  }

  private font(run: Run, bold: boolean) {
    return run.kind === "hindi" ? this.fonts.hindi : bold ? this.fonts.bold : this.fonts.regular;
  }

  private symbol(char: string, x: number, y: number, size: number, color: RGB) {
    const s = size * 0.7;
    const top = y + s;
    if (char === "✓")
      this.page.drawSvgPath(`M 0 ${s * 0.55} L ${s * 0.38} ${s * 0.95} L ${s} 0`, {
        x,
        y: top,
        borderColor: color,
        borderWidth: size * 0.12,
      });
    else if (char === "○")
      this.page.drawCircle({
        x: x + s / 2,
        y: y + s / 2,
        size: s / 2,
        borderColor: color,
        borderWidth: size * 0.08,
      });
    else
      this.page.drawSvgPath(
        char === "▲" ? `M 0 ${s} L ${s / 2} 0 L ${s} ${s} Z` : `M 0 0 L ${s / 2} ${s} L ${s} 0 Z`,
        { x, y: top, color },
      );
  }

  private draw(text: string, x: number, y: number, size: number, color: RGB, bold = false) {
    let cursor = x;
    for (const run of runs(clean(text))) {
      if (run.kind === "symbol") {
        this.symbol(run.text, cursor, y, size, color);
        cursor += size * 0.8;
        continue;
      }
      const font = this.font(run, bold);
      this.page.drawText(run.text, { x: cursor, y, size, font, color });
      cursor += font.widthOfTextAtSize(run.text, size);
    }
  }

  // Word-wrap to a width; long words are broken
  private wrap(text: string, size: number, maxWidth: number, bold = false) {
    const lines: string[] = [];
    for (const paragraph of clean(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (this.width(next, size, bold) <= maxWidth) {
          line = next;
          continue;
        }
        if (line) lines.push(line);
        line = word;
        while (this.width(line, size, bold) > maxWidth && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && this.width(line.slice(0, cut), size, bold) > maxWidth) cut--;
          lines.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
      lines.push(line);
    }
    return lines;
  }

  private fit(text: string, size: number, maxWidth: number, bold = false) {
    if (this.width(text, size, bold) <= maxWidth) return text;
    let cut = text.length;
    while (cut > 0 && this.width(`${text.slice(0, cut)}…`, size, bold) > maxWidth) cut--;
    return `${text.slice(0, cut)}…`;
  }

  // ---- blocks -----------------------------------------------------------
  private header(title: string, subtitle: string) {
    this.page.drawRectangle({ x: MARGIN, y: this.y - 4, width: 26, height: 26, color: COLORS.ember });
    this.draw("D", MARGIN + 8, this.y + 3, 15, COLORS.white, true);
    this.draw("Day One", MARGIN + 34, this.y + 5, 11, COLORS.muted, true);
    this.y -= 40;
    this.draw(title, MARGIN, this.y, 24, COLORS.ink, true);
    this.y -= 20;
    this.draw(subtitle, MARGIN, this.y, 12, COLORS.muted);
    this.y -= 14;
    this.rule(COLORS.ember, 1.5);
    this.y -= 10;
  }

  private rule(color = COLORS.faint, thickness = 0.6) {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE.width - MARGIN, y: this.y },
      thickness,
      color,
    });
  }

  heading(text: string, aside?: string) {
    // Keep a heading with at least a few lines of what follows
    this.ensure(90);
    this.y -= 18;
    this.draw(text, MARGIN, this.y, 15, COLORS.ink, true);
    if (aside) {
      const w = this.width(aside, 10);
      this.draw(aside, PAGE.width - MARGIN - w, this.y + 1, 10, COLORS.muted);
    }
    this.y -= 8;
    this.rule();
    this.y -= 6;
  }

  subheading(text: string, aside?: string) {
    this.ensure(30);
    this.y -= 14;
    this.draw(this.fit(text, 12, CONTENT - 120, true), MARGIN, this.y, 12, COLORS.ink, true);
    if (aside) {
      const w = this.width(aside, 10);
      this.draw(aside, PAGE.width - MARGIN - w, this.y, 10, COLORS.muted);
    }
    this.y -= 6;
  }

  text(content: string, options: { size?: number; color?: RGB; bold?: boolean; indent?: number } = {}) {
    const size = options.size ?? 10.5;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.45;
    for (const line of this.wrap(content, size, CONTENT - indent, options.bold)) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      this.draw(line, MARGIN + indent, this.y + 3, size, options.color ?? COLORS.ink, options.bold);
    }
  }

  muted(content: string) {
    this.text(content, { size: 9.5, color: COLORS.muted });
  }

  space(amount = 8) {
    this.y -= amount;
  }

  // Boxes with a label and a big number, 2–4 per row
  stats(items: { label: string; value: string; hint?: string; tone?: Tone }[], perRow = 4) {
    const gap = 8;
    const boxW = (CONTENT - gap * (perRow - 1)) / perRow;
    const boxH = 52;
    for (let i = 0; i < items.length; i += perRow) {
      this.ensure(boxH + gap + 4);
      this.y -= 6;
      const top = this.y;
      items.slice(i, i + perRow).forEach((item, j) => {
        const x = MARGIN + j * (boxW + gap);
        this.page.drawRectangle({
          x,
          y: top - boxH,
          width: boxW,
          height: boxH,
          color: COLORS.panel,
          borderColor: COLORS.faint,
          borderWidth: 0.6,
        });
        this.draw(this.fit(item.label, 8.5, boxW - 16), x + 8, top - 15, 8.5, COLORS.muted);
        this.draw(this.fit(item.value, 14, boxW - 16, true), x + 8, top - 33, 14, toneColor(item.tone), true);
        if (item.hint) this.draw(this.fit(item.hint, 7.5, boxW - 16), x + 8, top - 45, 7.5, COLORS.muted);
      });
      this.y = top - boxH - gap + 6;
    }
  }

  // Progress bar with a label and a figure on the right
  bar(label: string, ratio: number | null, right: string, tone?: Tone) {
    this.ensure(30);
    this.y -= 14;
    this.draw(this.fit(label, 10, CONTENT - 150), MARGIN, this.y, 10, COLORS.ink);
    const w = this.width(right, 10, true);
    this.draw(right, PAGE.width - MARGIN - w, this.y, 10, toneColor(tone), true);
    this.y -= 9;
    this.page.drawRectangle({ x: MARGIN, y: this.y, width: CONTENT, height: 5, color: COLORS.faint });
    if (ratio !== null && ratio > 0)
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y,
        width: CONTENT * Math.min(ratio, 1),
        height: 5,
        color: tone === "bad" ? COLORS.red : ratio >= 1 ? COLORS.moss : COLORS.ember,
      });
    this.y -= 4;
  }

  // Table with a header row that repeats on each new page
  table(columns: Column[], rows: Cell[][], options: { size?: number } = {}) {
    const size = options.size ?? 9.5;
    const pad = 5;
    const total = columns.reduce((sum, c) => sum + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * CONTENT);
    const lineHeight = size * 1.35;

    const drawHeader = () => {
      this.y -= size + 10;
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - 4,
        width: CONTENT,
        height: size + 10,
        color: COLORS.panel,
      });
      let x = MARGIN;
      columns.forEach((col, i) => {
        const label = this.fit(col.label, size - 0.5, widths[i] - pad * 2, true);
        const w = this.width(label, size - 0.5, true);
        const tx = col.align === "right" ? x + widths[i] - pad - w : x + pad;
        this.draw(label, tx, this.y, size - 0.5, COLORS.muted, true);
        x += widths[i];
      });
      this.y -= 4;
    };

    this.ensure(size * 4);
    drawHeader();
    for (const row of rows) {
      const cells = row.map((cell) => (typeof cell === "string" ? { text: cell } : cell));
      const wrapped = cells.map((cell, i) =>
        columns[i]?.align === "right"
          ? [this.fit(cell.text, size, widths[i] - pad * 2, cell.bold)]
          : this.wrap(cell.text, size, widths[i] - pad * 2, cell.bold),
      );
      const height = Math.max(...wrapped.map((l) => l.length)) * lineHeight + 6;
      if (this.y - height < MARGIN + FOOTER) {
        this.addPage();
        drawHeader();
      }
      let x = MARGIN;
      cells.forEach((cell, i) => {
        wrapped[i].forEach((line, n) => {
          const w = this.width(line, size, cell.bold);
          const tx = columns[i]?.align === "right" ? x + widths[i] - pad - w : x + pad;
          this.draw(line, tx, this.y - lineHeight * (n + 1) + 2, size, toneColor(cell.tone), cell.bold);
        });
        x += widths[i];
      });
      this.y -= height;
      this.rule();
    }
    this.y -= 4;
  }

  empty(message: string) {
    this.ensure(24);
    this.y -= 16;
    this.draw(message, MARGIN, this.y, 10, COLORS.muted);
    this.y -= 4;
  }

  async save() {
    const pages = this.doc.getPages();
    const stamp = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
    pages.forEach((page, i) => {
      this.page = page;
      const left = `Day One · Generated ${stamp}`;
      const right = `Page ${i + 1} of ${pages.length}`;
      this.draw(left, MARGIN, 22, 8, COLORS.muted);
      this.draw(right, PAGE.width - MARGIN - this.width(right, 8), 22, 8, COLORS.muted);
    });
    return this.doc.save();
  }
}

export const percent = (ratio: number | null) =>
  ratio === null ? "–" : `${Math.round(ratio * 100)}%`;
