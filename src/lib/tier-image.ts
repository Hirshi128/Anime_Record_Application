import { personalRatings, type PersonalRecord } from "./personal-library";

export const tierImageColors = { SS: "#c99b38", S: "#eed28a", A: "#ffffff", B: "#ffffff", C: "#ffffff", D: "#ffffff", E: "#ffffff" };
export function tierImageLayout(records: PersonalRecord[]) {
  const columns = 5, cardWidth = 164, cardHeight = 64, gap = 8;
  const rows = personalRatings.map(rating => ({ rating, records: records.filter(r => r.rating === rating) }));
  const heights = rows.map(row => Math.max(1, Math.ceil(row.records.length / columns)) * (cardHeight + gap) + 20);
  return { width: 1000, height: 100 + heights.reduce((a, b) => a + b, 0), rows, heights, columns, cardWidth, cardHeight, gap };
}

export async function createTierImage(records: PersonalRecord[], label: string): Promise<Blob | null> {
  const layout = tierImageLayout(records);
  // Bound memory use before creating a bitmap; no remote assets or user HTML are rendered.
  if (records.length > 1000 || layout.height > 16000) throw new Error("Image too large");
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = layout.width; canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.fillStyle = "#f7f8fa"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#171717"; context.font = "bold 24px sans-serif";
  context.fillText(`${label} ティア表`, 24, 42, 940);
  context.font = "14px sans-serif"; context.fillStyle = "#52525b";
  context.fillText(`Anime Record · ${records.length}作品`, 24, 68);
  let y = 90;
  layout.rows.forEach((row, index) => {
    context.fillStyle = "#171717"; context.font = "bold 22px sans-serif"; context.fillText(row.rating, 24, y + 42);
    row.records.forEach((record, i) => {
      const x = 100 + (i % layout.columns) * (layout.cardWidth + layout.gap);
      const top = y + Math.floor(i / layout.columns) * (layout.cardHeight + layout.gap);
      context.fillStyle = tierImageColors[row.rating]; context.fillRect(x, top, layout.cardWidth, layout.cardHeight);
      context.strokeStyle = row.rating === "SS" ? "#92702e" : "#d4d4d8"; context.strokeRect(x, top, layout.cardWidth, layout.cardHeight);
      context.fillStyle = "#52525b"; context.font = "10px sans-serif"; context.fillText(record.watchedMonth?.replace("-", "/") || "年月未登録", x + 8, top + 13);
      context.fillStyle = "#171717"; context.font = "bold 13px sans-serif";
      const chars = Array.from(record.title);
      let line = "", lineNumber = 0;
      for (let c = 0; c < chars.length; c++) {
        const next = line + chars[c];
        if (context.measureText(next).width > layout.cardWidth - 16 && line) {
          context.fillText(lineNumber === 1 ? line.slice(0, -1) + "…" : line, x + 8, top + 33 + lineNumber * 18);
          if (++lineNumber === 2) { line = ""; break; }
          line = chars[c];
        } else line = next;
      }
      if (line) context.fillText(line, x + 8, top + 33 + lineNumber * 18);
    });
    y += layout.heights[index];
  });
  return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}
