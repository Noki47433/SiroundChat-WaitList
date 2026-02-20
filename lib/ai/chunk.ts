type ChunkOptions = {
  maxChars: number;
  overlap: number;
};

// Splits text into overlapping chunks trying to keep paragraph/sentence boundaries.
export function chunkText(input: string, options: ChunkOptions): string[] {
  const { maxChars, overlap } = options;
  if (!input.trim()) return [];

  const normalized = input
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = normalized.split(/\n\n+/);
  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 50) {
      chunks.push(trimmed);
    } else if (!chunks.length && trimmed.length > 0) {
      chunks.push(trimmed); // last tiny remainder
    }
    buffer = "";
  };

  for (const para of paragraphs) {
    const text = para.trim();
    if (!text) continue;

    // If small, try to append to buffer
    if ((buffer + "\n\n" + text).length <= maxChars) {
      buffer = buffer ? `${buffer}\n\n${text}` : text;
      continue;
    }

    // Paragraph too big; split by sentences to avoid mid-sentence cuts
    const sentences = text.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const candidate = buffer ? `${buffer} ${sentence}` : sentence;
      if (candidate.length >= maxChars) {
        // Flush what we have, start new with current sentence
        flush();
        buffer = sentence;
        if (buffer.length >= maxChars) {
          chunks.push(buffer.slice(0, maxChars));
          buffer = buffer.slice(Math.max(0, maxChars - overlap));
        }
      } else {
        buffer = candidate;
      }
    }

    if (buffer.length >= maxChars) {
      flush();
    }
  }

  flush();

  // Apply overlap between consecutive chunks for context preservation
  if (overlap > 0 && chunks.length > 1) {
    const withOverlap: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        withOverlap.push(chunks[i]);
      } else {
        const prev = chunks[i - 1];
        const tail = prev.slice(-overlap);
        withOverlap.push(`${tail}\n${chunks[i]}`.slice(0, maxChars));
      }
    }
    return withOverlap;
  }

  return chunks;
}

// Tune maxChars to balance recall vs. token cost (e.g., 800-1500 chars).
// Overlap (e.g., 100-200 chars) keeps continuity across boundaries.
