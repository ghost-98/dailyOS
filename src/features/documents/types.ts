"use client";

export type DocumentTextTone = "default" | "green" | "blue" | "pink" | "amber" | "muted";
export type DocumentBackgroundTone = "none" | "green" | "blue" | "pink" | "amber" | "violet";

export type DocumentChecklistItem = {
  checked: boolean;
  id: string;
  text: string;
};

export type DocumentImageAsset = {
  fileName: string;
  filePath: string;
  fileUrl?: string;
  height?: number;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
};

type DocumentBlockBase = {
  backgroundTone?: DocumentBackgroundTone;
  id: string;
  textTone?: DocumentTextTone;
};

export type DocumentParagraphBlock = DocumentBlockBase & {
  text: string;
  type: "paragraph";
};

export type DocumentHeadingBlock = DocumentBlockBase & {
  text: string;
  type: "heading1" | "heading2" | "heading3";
};

export type DocumentToggleBlock = DocumentBlockBase & {
  children: DocumentBlock[];
  isOpen: boolean;
  title: string;
  type: "toggle";
};

export type DocumentChecklistBlock = DocumentBlockBase & {
  items: DocumentChecklistItem[];
  type: "checklist";
};

export type DocumentQuoteBlock = DocumentBlockBase & {
  text: string;
  type: "quote";
};

export type DocumentCalloutBlock = DocumentBlockBase & {
  icon: string;
  text: string;
  type: "callout";
};

export type DocumentDividerBlock = DocumentBlockBase & {
  type: "divider";
};

export type DocumentImageBlock = DocumentBlockBase & {
  caption: string;
  image?: DocumentImageAsset;
  type: "image";
};

export type DocumentTableBlock = DocumentBlockBase & {
  hasHeaderRow: boolean;
  rows: string[][];
  type: "table";
};

export type DocumentBlock =
  | DocumentParagraphBlock
  | DocumentHeadingBlock
  | DocumentToggleBlock
  | DocumentChecklistBlock
  | DocumentQuoteBlock
  | DocumentCalloutBlock
  | DocumentDividerBlock
  | DocumentImageBlock
  | DocumentTableBlock;

export type DocumentRecord = {
  content: DocumentBlock[];
  createdAt?: string;
  folder?: string;
  icon?: string;
  id: string;
  summary?: string;
  tags: string[];
  title: string;
  updatedAt?: string;
};
