import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ChatBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "unordered_list"; items: string[] }
  | { type: "ordered_list"; items: string[] };

const UNORDERED_LIST_PATTERN = /^[-*]\s+(.*)$/;
const ORDERED_LIST_PATTERN = /^\d+[.)]\s+(.*)$/;

function normalizeContent(content: string) {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/([:;.!?])\s+(?=(?:[-*]|\d+[.)])\s)/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseBlocks(content: string): ChatBlock[] {
  const normalized = normalizeContent(content);
  if (!normalized) return [];

  const blocks: ChatBlock[] = [];
  const paragraphLines: string[] = [];
  let activeList: ChatBlock | null = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ type: "paragraph", lines: [...paragraphLines] });
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (!activeList) return;
    blocks.push(activeList);
    activeList = null;
  };

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const unorderedMatch = line.match(UNORDERED_LIST_PATTERN);
    if (unorderedMatch) {
      flushParagraph();
      if (!activeList || activeList.type !== "unordered_list") {
        flushList();
        activeList = { type: "unordered_list", items: [] };
      }
      activeList.items.push(unorderedMatch[1].trim());
      continue;
    }

    const orderedMatch = line.match(ORDERED_LIST_PATTERN);
    if (orderedMatch) {
      flushParagraph();
      if (!activeList || activeList.type !== "ordered_list") {
        flushList();
        activeList = { type: "ordered_list", items: [] };
      }
      activeList.items.push(orderedMatch[1].trim());
      continue;
    }

    if (activeList && (/^\s{2,}\S/.test(rawLine) || /^\t+\S/.test(rawLine))) {
      const lastItemIndex = activeList.items.length - 1;
      activeList.items[lastItemIndex] = `${activeList.items[lastItemIndex]} ${line}`.trim();
      continue;
    }

    flushList();

    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function renderInline(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let matchIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(
      <strong key={`${keyPrefix}-strong-${matchIndex}`} className="font-semibold">
        {match[1]}
      </strong>
    );

    lastIndex = match.index + match[0].length;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length ? nodes : text;
}

export function FormattedChatMessage({
  content,
  className
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseBlocks(content);

  if (!blocks.length) {
    return <span>{content}</span>;
  }

  return (
    <div className={cn("space-y-3 break-words", className)}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "paragraph") {
          return (
            <p key={`paragraph-${blockIndex}`} className="leading-relaxed">
              {block.lines.map((line, lineIndex) => (
                <span key={`paragraph-${blockIndex}-line-${lineIndex}`}>
                  {lineIndex > 0 ? <br /> : null}
                  {renderInline(line, `paragraph-${blockIndex}-line-${lineIndex}`)}
                </span>
              ))}
            </p>
          );
        }

        const ListTag = block.type === "ordered_list" ? "ol" : "ul";
        const listClassName = block.type === "ordered_list" ? "list-decimal pl-5" : "list-disc pl-5";

        return (
          <ListTag key={`list-${blockIndex}`} className={cn(listClassName, "space-y-1.5 leading-relaxed")}>
            {block.items.map((item, itemIndex) => (
              <li key={`list-${blockIndex}-item-${itemIndex}`}>{renderInline(item, `list-${blockIndex}-item-${itemIndex}`)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
