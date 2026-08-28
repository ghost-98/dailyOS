import type {
  DocumentBackgroundTone,
  DocumentBlock,
  DocumentChecklistBlock,
  DocumentChecklistItem,
  DocumentImageAsset,
  DocumentRecord,
  DocumentTextTone,
  DocumentToggleBlock,
} from "@/features/documents/types";

type DocumentBlockType = DocumentBlock["type"];

export const documentTextToneOptions: Array<{ label: string; value: DocumentTextTone }> = [
  { label: "기본", value: "default" },
  { label: "초록", value: "green" },
  { label: "파랑", value: "blue" },
  { label: "분홍", value: "pink" },
  { label: "호박", value: "amber" },
  { label: "옅은 회색", value: "muted" },
];

export const documentBackgroundToneOptions: Array<{ label: string; value: DocumentBackgroundTone }> = [
  { label: "없음", value: "none" },
  { label: "보라", value: "violet" },
  { label: "초록", value: "green" },
  { label: "파랑", value: "blue" },
  { label: "분홍", value: "pink" },
  { label: "호박", value: "amber" },
];

export const documentBlockTypeLabels: Record<DocumentBlockType, string> = {
  callout: "콜아웃",
  checklist: "체크리스트",
  divider: "구분선",
  heading1: "제목 1",
  heading2: "제목 2",
  heading3: "제목 3",
  image: "이미지",
  paragraph: "본문",
  quote: "인용",
  table: "표",
  toggle: "토글",
};

export function createDocumentRecord(): Omit<DocumentRecord, "id"> {
  return {
    content: [createDocumentBlock("heading1"), createDocumentBlock("paragraph")],
    folder: "",
    icon: "📝",
    summary: "",
    tags: [],
    title: "새 문서",
  };
}

export function createDocumentBlock(type: DocumentBlockType): DocumentBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading1":
    case "heading2":
    case "heading3":
      return { id, text: "", type };
    case "toggle":
      return { children: [createDocumentBlock("paragraph")], id, isOpen: true, title: "", type };
    case "checklist":
      return { id, items: [createChecklistItem()], type };
    case "quote":
      return { id, text: "", type };
    case "callout":
      return { backgroundTone: "violet", icon: "💡", id, text: "", type };
    case "divider":
      return { id, type };
    case "image":
      return { caption: "", id, type };
    case "table":
      return { hasHeaderRow: true, id, rows: [["제목", "값"], ["", ""]], type };
    case "paragraph":
    default:
      return { id, text: "", type: "paragraph" };
  }
}

export function createChecklistItem(): DocumentChecklistItem {
  return { checked: false, id: crypto.randomUUID(), text: "" };
}

export function normalizeDocumentContent(value: unknown): DocumentBlock[] {
  if (!Array.isArray(value)) return [createDocumentBlock("paragraph")];
  const blocks = value.map((entry) => normalizeDocumentBlock(entry)).filter((entry): entry is DocumentBlock => Boolean(entry));
  return blocks.length > 0 ? blocks : [createDocumentBlock("paragraph")];
}

function normalizeDocumentBlock(value: unknown): DocumentBlock | null {
  if (!value || typeof value !== "object") return null;
  const block = value as Partial<DocumentBlock> & Record<string, unknown>;
  const type = typeof block.type === "string" ? block.type : "paragraph";

  if (type === "checklist") {
    const items = Array.isArray(block.items)
      ? block.items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const current = item as Partial<DocumentChecklistItem>;
          return {
            checked: Boolean(current.checked),
            id: typeof current.id === "string" ? current.id : crypto.randomUUID(),
            text: typeof current.text === "string" ? current.text : "",
          };
        })
        .filter((item): item is DocumentChecklistItem => Boolean(item))
      : [createChecklistItem()];
    return {
      backgroundTone: normalizeBackgroundTone(block.backgroundTone),
      id: typeof block.id === "string" ? block.id : crypto.randomUUID(),
      items: items.length > 0 ? items : [createChecklistItem()],
      textTone: normalizeTextTone(block.textTone),
      type: "checklist",
    } satisfies DocumentChecklistBlock;
  }

  if (type === "toggle") {
    return {
      backgroundTone: normalizeBackgroundTone(block.backgroundTone),
      children: normalizeDocumentContent(block.children),
      id: typeof block.id === "string" ? block.id : crypto.randomUUID(),
      isOpen: typeof block.isOpen === "boolean" ? block.isOpen : true,
      textTone: normalizeTextTone(block.textTone),
      title: typeof block.title === "string" ? block.title : "",
      type: "toggle",
    } satisfies DocumentToggleBlock;
  }

  if (type === "callout") {
    return {
      backgroundTone: normalizeBackgroundTone(block.backgroundTone) ?? "violet",
      icon: typeof block.icon === "string" ? block.icon : "💡",
      id: typeof block.id === "string" ? block.id : crypto.randomUUID(),
      text: typeof block.text === "string" ? block.text : "",
      textTone: normalizeTextTone(block.textTone),
      type: "callout",
    };
  }

  if (type === "image") {
    return {
      backgroundTone: normalizeBackgroundTone(block.backgroundTone),
      caption: typeof block.caption === "string" ? block.caption : "",
      id: typeof block.id === "string" ? block.id : crypto.randomUUID(),
      image: normalizeImageAsset(block.image),
      textTone: normalizeTextTone(block.textTone),
      type: "image",
    };
  }

  if (type === "table") {
    const rows = Array.isArray(block.rows)
      ? block.rows.filter(Array.isArray).map((row) => row.map((cell) => (typeof cell === "string" ? cell : "")))
      : [["제목", "값"], ["", ""]];
    return {
      backgroundTone: normalizeBackgroundTone(block.backgroundTone),
      hasHeaderRow: typeof block.hasHeaderRow === "boolean" ? block.hasHeaderRow : true,
      id: typeof block.id === "string" ? block.id : crypto.randomUUID(),
      rows: rows.length > 0 ? rows : [["제목", "값"], ["", ""]],
      textTone: normalizeTextTone(block.textTone),
      type: "table",
    };
  }

  if (type === "divider") {
    return {
      backgroundTone: normalizeBackgroundTone(block.backgroundTone),
      id: typeof block.id === "string" ? block.id : crypto.randomUUID(),
      textTone: normalizeTextTone(block.textTone),
      type: "divider",
    };
  }

  const textBlockType = ["paragraph", "heading1", "heading2", "heading3", "quote"].includes(type) ? type : "paragraph";
  return {
    backgroundTone: normalizeBackgroundTone(block.backgroundTone),
    id: typeof block.id === "string" ? block.id : crypto.randomUUID(),
    text: typeof block.text === "string" ? block.text : "",
    textTone: normalizeTextTone(block.textTone),
    type: textBlockType as "paragraph" | "heading1" | "heading2" | "heading3" | "quote",
  };
}

function normalizeImageAsset(value: unknown): DocumentImageAsset | undefined {
  if (!value || typeof value !== "object") return undefined;
  const asset = value as Partial<DocumentImageAsset>;
  if (!asset.filePath || !asset.fileName) return undefined;
  return {
    fileName: String(asset.fileName),
    filePath: String(asset.filePath),
    fileUrl: typeof asset.fileUrl === "string" ? asset.fileUrl : undefined,
    height: typeof asset.height === "number" ? asset.height : undefined,
    mimeType: typeof asset.mimeType === "string" ? asset.mimeType : undefined,
    sizeBytes: typeof asset.sizeBytes === "number" ? asset.sizeBytes : undefined,
    width: typeof asset.width === "number" ? asset.width : undefined,
  };
}

function normalizeTextTone(value: unknown): DocumentTextTone | undefined {
  return typeof value === "string" && documentTextToneOptions.some((option) => option.value === value as DocumentTextTone)
    ? (value as DocumentTextTone)
    : undefined;
}

function normalizeBackgroundTone(value: unknown): DocumentBackgroundTone | undefined {
  return typeof value === "string" && documentBackgroundToneOptions.some((option) => option.value === value as DocumentBackgroundTone)
    ? (value as DocumentBackgroundTone)
    : undefined;
}

export function summarizeDocument(title: string, content: DocumentBlock[]) {
  const merged = [title.trim(), ...collectDocumentTexts(content)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return merged.slice(0, 180);
}

function collectDocumentTexts(content: DocumentBlock[]): string[] {
  return content.flatMap((block) => {
    switch (block.type) {
      case "checklist":
        return block.items.map((item) => item.text.trim()).filter(Boolean);
      case "toggle":
        return [block.title.trim(), ...collectDocumentTexts(block.children)].filter(Boolean);
      case "table":
        return block.rows.flatMap((row) => row.map((cell) => cell.trim()).filter(Boolean));
      case "divider":
        return [];
      case "image":
        return [block.caption.trim()].filter(Boolean);
      default:
        return [("text" in block ? block.text : "")?.trim()].filter(Boolean);
    }
  });
}

export function stripTransientDocumentFields(content: DocumentBlock[]): DocumentBlock[] {
  return content.map((block) => {
    if (block.type === "image" && block.image) {
      const { fileUrl, ...image } = block.image;
      return { ...block, image };
    }
    if (block.type === "toggle") {
      return { ...block, children: stripTransientDocumentFields(block.children) };
    }
    return block;
  });
}

export async function hydrateDocumentImages(content: DocumentBlock[], getUrl: (path: string) => Promise<string | null>): Promise<DocumentBlock[]> {
  return Promise.all(
    content.map(async (block) => {
      if (block.type === "image" && block.image?.filePath) {
        const fileUrl = await getUrl(block.image.filePath);
        return { ...block, image: { ...block.image, fileUrl: fileUrl ?? undefined } };
      }
      if (block.type === "toggle") {
        return { ...block, children: await hydrateDocumentImages(block.children, getUrl) };
      }
      return block;
    }),
  );
}

export function collectDocumentFilePathsFromBlocks(content: unknown) {
  return collectDocumentFilePaths(normalizeDocumentContent(content));
}

function collectDocumentFilePaths(content: DocumentBlock[]): string[] {
  return content.flatMap((block) => {
    if (block.type === "image" && block.image?.filePath) return [block.image.filePath];
    if (block.type === "toggle") return collectDocumentFilePaths(block.children);
    return [];
  }).filter(Boolean);
}

export function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function parseDocumentTags(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

