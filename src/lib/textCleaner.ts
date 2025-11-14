import type { DocumentRecord } from "@/types/document";

interface CleanResult {
  cleanText: string;
  cleanMap: number[];
  cleanReverseMap: number[];
}

type Cell = {
  char: string;
  rawIndex: number;
};

type Line = {
  content: Cell[];
  newline?: Cell;
};

const isSeparatorLine = (text: string) => /^[_\-\s]{5,}$/.test(text);

const normalizeLineContent = (content: Cell[]): Cell[] => {
  const normalized: Cell[] = [];
  let lastWasSpace = true;

  for (let i = 0; i < content.length; i++) {
    const cell = content[i];
    let char = cell.char;

    if (char === "\t" || char === "\u00a0") {
      char = " ";
    }

    if (char === "_") {
      let run = 1;
      while (i + run < content.length && content[i + run].char === "_") {
        run++;
      }
      if (run >= 3) {
        i += run - 1;
        continue;
      }
    }

    if (char === " ") {
      if (lastWasSpace) {
        continue;
      }
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
    }

    normalized.push({ char, rawIndex: cell.rawIndex });
  }

  // Trim leading space leftover after collapsing underscores
  while (normalized.length && normalized[0].char === " ") {
    normalized.shift();
  }

  // Trim trailing space to avoid dangling blanks before newline
  while (normalized.length && normalized[normalized.length - 1].char === " ") {
    normalized.pop();
  }

  return normalized;
};

const splitIntoLines = (cells: Cell[]): Line[] => {
  const lines: Line[] = [];
  let current: Cell[] = [];

  cells.forEach((cell) => {
    if (cell.char === "\n") {
      lines.push({ content: current, newline: cell });
      current = [];
    } else {
      current.push(cell);
    }
  });

  if (current.length) {
    lines.push({ content: current });
  }

  return lines;
};

const rebuildCells = (lines: Line[]): Cell[] => {
  const result: Cell[] = [];
  lines.forEach((line) => {
    result.push(...line.content);
    if (line.newline) {
      result.push(line.newline);
    }
  });
  return result;
};

export const generateCleanText = (raw: string): CleanResult => {
  if (!raw) {
    return { cleanText: "", cleanMap: [], cleanReverseMap: [] };
  }

  const normalized: Cell[] = [];
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char === "\r") {
      if (raw[i + 1] === "\n") {
        normalized.push({ char: "\n", rawIndex: i });
        i++;
      } else {
        normalized.push({ char: "\n", rawIndex: i });
      }
    } else {
      normalized.push({ char, rawIndex: i });
    }
  }

  const lines = splitIntoLines(normalized);
  const processed: Line[] = [];
  let blankStreak = 0;

  lines.forEach((line) => {
    const text = line.content.map((cell) => cell.char).join("");
    const trimmed = text.trim();

    if (!trimmed.length) {
      blankStreak += 1;
      if (blankStreak > 1) {
        return;
      }
      processed.push({ content: [], newline: line.newline });
      return;
    }

    blankStreak = 0;
    if (isSeparatorLine(trimmed)) {
      return;
    }

    const normalizedContent = normalizeLineContent(line.content);
    if (!normalizedContent.length) {
      processed.push({ content: [], newline: line.newline });
    } else {
      processed.push({ content: normalizedContent, newline: line.newline });
    }
  });

  const finalCells = rebuildCells(processed);
  const cleanText = finalCells.map((cell) => cell.char).join("");
  const cleanMap = finalCells.map((cell) => cell.rawIndex);
  const cleanReverseMap = new Array(raw.length).fill(-1);
  finalCells.forEach((cell, index) => {
    cleanReverseMap[cell.rawIndex] = index;
  });

  return { cleanText, cleanMap, cleanReverseMap };
};

export const attachCleanVariants = (doc: DocumentRecord): DocumentRecord => {
  const { cleanText, cleanMap, cleanReverseMap } = generateCleanText(doc.text);
  return { ...doc, cleanText, cleanMap, cleanReverseMap };
};
