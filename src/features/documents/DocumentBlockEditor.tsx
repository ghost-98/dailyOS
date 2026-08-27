"use client";

import { ChevronDown, ChevronUp, GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { IconButton } from "@/components/ui/IconButton";
import type { DocumentBlock, DocumentChecklistItem, DocumentImageAsset } from "@/features/documents/types";
import {
  createChecklistItem,
  createDocumentBlock,
  documentBackgroundToneOptions,
  documentBlockTypeLabels,
  documentTextToneOptions,
  moveArrayItem,
} from "@/features/documents/utils";

type DocumentBlockEditorProps = {
  block: DocumentBlock;
  depth?: number;
  index: number;
  isUploading: boolean;
  isDragging?: boolean;
  onAddBelow: (type: DocumentBlock["type"], index: number) => void;
  onChange: (nextBlock: DocumentBlock) => void;
  onDelete: () => void;
  onDragEnd?: () => void;
  onDragStart?: (blockId: string) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onReplaceImage: (file: File, previousImage?: DocumentImageAsset) => Promise<void>;
};

export function DocumentBlockEditor({
  block,
  depth = 0,
  index,
  isUploading,
  isDragging = false,
  onAddBelow,
  onChange,
  onDelete,
  onDragEnd,
  onDragStart,
  onMoveDown,
  onMoveUp,
  onReplaceImage,
}: DocumentBlockEditorProps) {
  return (
    <article
      className={`doc-block doc-block--${block.type} ${isDragging ? "doc-block--dragging" : ""}`}
      data-background-tone={block.backgroundTone ?? "none"}
      data-depth={depth}
      data-text-tone={block.textTone ?? "default"}
    >
      <div className="doc-block__rail">
        <button
          className="doc-drag-handle"
          draggable
          onDragEnd={onDragEnd}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/document-block-id", block.id);
            onDragStart?.(block.id);
          }}
          type="button"
        >
          <GripVertical aria-hidden size={14} />
        </button>
        <div className="doc-block__inline-tools">
          <select aria-label="블록 종류 추가" value="" onChange={(event) => {
            if (!event.target.value) return;
            onAddBelow(event.target.value as DocumentBlock["type"], index);
            event.target.value = "";
          }}>
            <option value="">+</option>
            {Object.entries(documentBlockTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select aria-label="글자색" value={block.textTone ?? "default"} onChange={(event) => onChange({ ...block, textTone: event.target.value === "default" ? undefined : event.target.value as DocumentBlock["textTone"] })}>
            {documentTextToneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select aria-label="배경색" value={block.backgroundTone ?? "none"} onChange={(event) => onChange({ ...block, backgroundTone: event.target.value === "none" ? undefined : event.target.value as DocumentBlock["backgroundTone"] })}>
            {documentBackgroundToneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div className="doc-block__content">
        <div className="doc-block__side-actions">
          <IconButton label="위로 이동" onClick={onMoveUp} size="sm" tone="ghost"><ChevronUp aria-hidden size={15} /></IconButton>
          <IconButton label="아래로 이동" onClick={onMoveDown} size="sm" tone="ghost"><ChevronDown aria-hidden size={15} /></IconButton>
          <IconButton label="블록 삭제" onClick={onDelete} size="sm" tone="danger"><Trash2 aria-hidden size={15} /></IconButton>
        </div>
        <DocumentBlockFields block={block} depth={depth} isUploading={isUploading} onChange={onChange} onReplaceImage={onReplaceImage} />
      </div>
    </article>
  );
}

function DocumentBlockFields({
  block,
  depth,
  isUploading,
  onChange,
  onReplaceImage,
}: {
  block: DocumentBlock;
  depth: number;
  isUploading: boolean;
  onChange: (nextBlock: DocumentBlock) => void;
  onReplaceImage: (file: File, previousImage?: DocumentImageAsset) => Promise<void>;
}) {
  if (block.type === "divider") return <div className="doc-divider" />;

  if (block.type === "image") {
    return (
      <div className="doc-block__body doc-block__body--image">
        {block.image?.fileUrl ? <img alt={block.caption || block.image.fileName} className="doc-image-preview" src={block.image.fileUrl} /> : null}
        <div className="doc-image-actions">
          <label className="doc-image-upload">
            <input accept="image/*" hidden type="file" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onReplaceImage(file, block.image);
              event.currentTarget.value = "";
            }} />
            <ImagePlus aria-hidden size={16} />
            {isUploading ? "업로드 중..." : block.image ? "이미지 교체" : "이미지 올리기"}
          </label>
        </div>
        <AutoSizeTextarea className="doc-image-caption" minRows={1} placeholder="이미지 설명" value={block.caption} onChange={(value) => onChange({ ...block, caption: value })} />
      </div>
    );
  }

  if (block.type === "checklist") {
    return (
      <div className="doc-block__body">
        <div className="doc-checklist">
          {block.items.map((item) => (
            <ChecklistRow
              item={item}
              key={item.id}
              onChange={(nextItem) => onChange({ ...block, items: block.items.map((current) => current.id === nextItem.id ? nextItem : current) })}
              onRemove={() => onChange({ ...block, items: block.items.length === 1 ? [createChecklistItem()] : block.items.filter((current) => current.id !== item.id) })}
            />
          ))}
        </div>
        <button className="doc-ghost-add" onClick={() => onChange({ ...block, items: [...block.items, createChecklistItem()] })} type="button">+ 체크 항목 추가</button>
      </div>
    );
  }

  if (block.type === "toggle") {
    return (
      <div className="doc-block__body">
        <button className="doc-toggle-button" onClick={() => onChange({ ...block, isOpen: !block.isOpen })} type="button">
          <span>{block.isOpen ? "▾" : "▸"}</span>
          <strong>{block.title.trim() || "토글"}</strong>
        </button>
        <AutoSizeTextarea className="doc-toggle-title" minRows={1} placeholder="토글 제목" value={block.title} onChange={(value) => onChange({ ...block, title: value })} />
        {block.isOpen ? (
          <>
            <div className="doc-nested-blocks">
              {block.children.map((child, childIndex) => (
                <DocumentBlockEditor
                  block={child}
                  depth={depth + 1}
                  index={childIndex}
                  isDragging={false}
                  isUploading={isUploading}
                  key={child.id}
                  onAddBelow={(type, targetIndex) => {
                    const nextChildren = [...block.children];
                    nextChildren.splice(targetIndex + 1, 0, createDocumentBlock(type));
                    onChange({ ...block, children: nextChildren });
                  }}
                  onChange={(nextChild) => onChange({ ...block, children: block.children.map((current) => current.id === child.id ? nextChild : current) })}
                  onDelete={() => onChange({ ...block, children: block.children.length === 1 ? [createDocumentBlock("paragraph")] : block.children.filter((current) => current.id !== child.id) })}
                  onMoveDown={() => onChange({ ...block, children: moveArrayItem(block.children, childIndex, Math.min(block.children.length - 1, childIndex + 1)) })}
                  onMoveUp={() => onChange({ ...block, children: moveArrayItem(block.children, childIndex, Math.max(0, childIndex - 1)) })}
                  onReplaceImage={onReplaceImage}
                />
              ))}
            </div>
            <button className="doc-ghost-add" onClick={() => onChange({ ...block, children: [...block.children, createDocumentBlock("paragraph")] })} type="button">+ 하위 블록 추가</button>
          </>
        ) : null}
      </div>
    );
  }

  if (block.type === "table") {
    return (
      <div className="doc-block__body doc-block__body--table">
        <label className="doc-table-toggle">
          <input checked={block.hasHeaderRow} type="checkbox" onChange={(event) => onChange({ ...block, hasHeaderRow: event.target.checked })} />
          <span>첫 줄 헤더</span>
        </label>
        <div className="doc-table-wrap">
          <table className="doc-table">
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${block.id}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${block.id}-${rowIndex}-${cellIndex}`}>
                      <input
                        placeholder="내용"
                        value={cell}
                        onChange={(event) => onChange({
                          ...block,
                          rows: block.rows.map((currentRow, currentRowIndex) =>
                            currentRowIndex === rowIndex
                              ? currentRow.map((currentCell, currentCellIndex) => currentCellIndex === cellIndex ? event.target.value : currentCell)
                              : currentRow,
                          ),
                        })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="doc-table-actions">
          <button className="doc-ghost-add" onClick={() => onChange({ ...block, rows: [...block.rows, new Array(block.rows[0]?.length ?? 2).fill("")] })} type="button">+ 행</button>
          <button className="doc-ghost-add" onClick={() => onChange({ ...block, rows: block.rows.map((row) => [...row, ""]) })} type="button">+ 열</button>
          <button className="doc-ghost-add" disabled={block.rows.length <= 1} onClick={() => onChange({ ...block, rows: block.rows.slice(0, -1) })} type="button">- 행</button>
          <button className="doc-ghost-add" disabled={(block.rows[0]?.length ?? 0) <= 1} onClick={() => onChange({ ...block, rows: block.rows.map((row) => row.slice(0, -1)) })} type="button">- 열</button>
        </div>
      </div>
    );
  }

  if (block.type === "callout") {
    return (
      <div className="doc-block__body doc-block__body--callout">
        <input className="doc-callout-icon" maxLength={4} placeholder="💡" value={block.icon} onChange={(event) => onChange({ ...block, icon: event.target.value })} />
        <AutoSizeTextarea className="doc-callout-text" minRows={2} placeholder="강조해서 남길 문맥" value={block.text} onChange={(value) => onChange({ ...block, text: value })} />
      </div>
    );
  }

  const minRows = block.type === "paragraph" ? 1 : block.type === "quote" ? 2 : 1;
  return (
    <div className="doc-block__body">
      <AutoSizeTextarea
        className={`doc-textarea doc-textarea--${block.type}`}
        minRows={minRows}
        placeholder={block.type.startsWith("heading") ? "제목" : block.type === "quote" ? "인용" : "내용을 입력하세요. / 로 새 블록을 추가할 수 있는 느낌으로 써보세요."}
        value={block.text}
        onChange={(value) => onChange({ ...block, text: value })}
      />
    </div>
  );
}

function ChecklistRow({ item, onChange, onRemove }: { item: DocumentChecklistItem; onChange: (nextItem: DocumentChecklistItem) => void; onRemove: () => void }) {
  return (
    <div className="doc-checklist__row">
      <label><input checked={item.checked} type="checkbox" onChange={(event) => onChange({ ...item, checked: event.target.checked })} /></label>
      <AutoSizeTextarea className="doc-checklist__text" minRows={1} placeholder="할 일" value={item.text} onChange={(value) => onChange({ ...item, text: value })} />
      <IconButton label="항목 삭제" onClick={onRemove} size="sm" tone="ghost"><Trash2 aria-hidden size={14} /></IconButton>
    </div>
  );
}

function AutoSizeTextarea({
  className = "",
  minRows = 1,
  onChange,
  placeholder,
  value,
}: {
  className?: string;
  minRows?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    const nextHeight = Math.max(element.scrollHeight, minRows * 28);
    element.style.height = `${nextHeight}px`;
  }, [minRows, value]);

  return (
    <textarea
      ref={ref}
      className={className}
      placeholder={placeholder}
      rows={minRows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
