"use client";

import { ChevronDown, ChevronUp, GripVertical, ImagePlus, Minus, Plus, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
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
  onAddBelow: (type: DocumentBlock["type"], index: number) => void;
  onChange: (nextBlock: DocumentBlock) => void;
  onDelete: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onReplaceImage: (file: File, previousImage?: DocumentImageAsset) => Promise<void>;
};

export function DocumentBlockEditor({
  block,
  depth = 0,
  index,
  isUploading,
  onAddBelow,
  onChange,
  onDelete,
  onMoveDown,
  onMoveUp,
  onReplaceImage,
}: DocumentBlockEditorProps) {
  return (
    <article
      className={`doc-block doc-block--${block.type}`}
      data-background-tone={block.backgroundTone ?? "none"}
      data-depth={depth}
      data-text-tone={block.textTone ?? "default"}
      draggable
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const sourceIndex = Number(event.dataTransfer.getData("text/document-block-index"));
        if (Number.isNaN(sourceIndex)) return;
        if (sourceIndex < index) onMoveUp();
        if (sourceIndex > index) onMoveDown();
      }}
      onDragStart={(event) => event.dataTransfer.setData("text/document-block-index", String(index))}
    >
      <div className="doc-block__toolbar">
        <div className="doc-block__meta">
          <button className="doc-drag-handle" type="button">
            <GripVertical aria-hidden size={14} />
          </button>
          <span>{index + 1}</span>
          <select aria-label="블록 글자색" value={block.textTone ?? "default"} onChange={(event) => onChange({ ...block, textTone: event.target.value === "default" ? undefined : event.target.value as DocumentBlock["textTone"] })}>
            {documentTextToneOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select aria-label="블록 배경색" value={block.backgroundTone ?? "none"} onChange={(event) => onChange({ ...block, backgroundTone: event.target.value === "none" ? undefined : event.target.value as DocumentBlock["backgroundTone"] })}>
            {documentBackgroundToneOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="doc-block__actions">
          <select aria-label="블록 추가" value="" onChange={(event) => {
            if (!event.target.value) return;
            onAddBelow(event.target.value as DocumentBlock["type"], index);
            event.target.value = "";
          }}>
            <option value="">블록 추가</option>
            {Object.entries(documentBlockTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <IconButton label="위로 이동" onClick={onMoveUp} size="sm" tone="ghost">
            <ChevronUp aria-hidden size={15} />
          </IconButton>
          <IconButton label="아래로 이동" onClick={onMoveDown} size="sm" tone="ghost">
            <ChevronDown aria-hidden size={15} />
          </IconButton>
          <IconButton label="블록 삭제" onClick={onDelete} size="sm" tone="danger">
            <Trash2 aria-hidden size={15} />
          </IconButton>
        </div>
      </div>
      <DocumentBlockFields block={block} depth={depth} isUploading={isUploading} onAddBelow={(type) => onAddBelow(type, index)} onChange={onChange} onReplaceImage={onReplaceImage} />
    </article>
  );
}

function DocumentBlockFields({
  block,
  depth,
  isUploading,
  onAddBelow,
  onChange,
  onReplaceImage,
}: {
  block: DocumentBlock;
  depth: number;
  isUploading: boolean;
  onAddBelow: (type: DocumentBlock["type"]) => void;
  onChange: (nextBlock: DocumentBlock) => void;
  onReplaceImage: (file: File, previousImage?: DocumentImageAsset) => Promise<void>;
}) {
  if (block.type === "divider") return <div className="doc-divider" />;

  if (block.type === "image") {
    return (
      <div className="doc-block__body">
        <label className="doc-image-upload">
          <input accept="image/*" hidden type="file" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void onReplaceImage(file, block.image);
            event.currentTarget.value = "";
          }} />
          <ImagePlus aria-hidden size={16} />
          {isUploading ? "업로드 중..." : block.image ? "이미지 교체" : "이미지 업로드"}
        </label>
        {block.image?.fileUrl ? <img alt={block.caption || block.image.fileName} className="doc-image-preview" src={block.image.fileUrl} /> : null}
        <input placeholder="이미지 설명" value={block.caption} onChange={(event) => onChange({ ...block, caption: event.target.value })} />
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
        <ActionButton className="doc-inline-action" onClick={() => onChange({ ...block, items: [...block.items, createChecklistItem()] })} variant="secondary">
          <Plus aria-hidden size={14} />체크 추가
        </ActionButton>
      </div>
    );
  }

  if (block.type === "toggle") {
    return (
      <div className="doc-block__body">
        <button className="doc-toggle-button" onClick={() => onChange({ ...block, isOpen: !block.isOpen })} type="button">
          <span>{block.isOpen ? "▾" : "▸"}</span>
          <strong>{block.title.trim() || "토글 제목"}</strong>
        </button>
        <input placeholder="토글 제목" value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
        {block.isOpen ? (
          <>
            <div className="doc-nested-blocks">
              {block.children.map((child, childIndex) => (
                <DocumentBlockEditor
                  block={child}
                  depth={depth + 1}
                  index={childIndex}
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
            <div className="documents-add-row documents-add-row--nested">
              <ActionButton onClick={() => onChange({ ...block, children: [...block.children, createDocumentBlock("paragraph")] })} variant="secondary">하위 본문</ActionButton>
              <ActionButton onClick={() => onChange({ ...block, children: [...block.children, createDocumentBlock("toggle")] })} variant="secondary">하위 토글</ActionButton>
              <ActionButton onClick={() => onChange({ ...block, children: [...block.children, createDocumentBlock("image")] })} variant="secondary">하위 이미지</ActionButton>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  if (block.type === "table") {
    return (
      <div className="doc-block__body">
        <label className="doc-table-toggle">
          <input checked={block.hasHeaderRow} type="checkbox" onChange={(event) => onChange({ ...block, hasHeaderRow: event.target.checked })} />
          <span>첫 줄을 헤더로 사용</span>
        </label>
        <div className="doc-table-wrap">
          <table className="doc-table"><tbody>{block.rows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${block.id}-${rowIndex}-${cellIndex}`}><input placeholder="내용" value={cell} onChange={(event) => onChange({ ...block, rows: block.rows.map((currentRow, currentRowIndex) => currentRowIndex === rowIndex ? currentRow.map((currentCell, currentCellIndex) => currentCellIndex === cellIndex ? event.target.value : currentCell) : currentRow) })} /></td>)}</tr>)}</tbody></table>
        </div>
        <div className="doc-table-actions">
          <ActionButton className="doc-inline-action" onClick={() => onChange({ ...block, rows: [...block.rows, new Array(block.rows[0]?.length ?? 2).fill("")] })} variant="secondary"><Plus aria-hidden size={14} />행 추가</ActionButton>
          <ActionButton className="doc-inline-action" onClick={() => onChange({ ...block, rows: block.rows.map((row) => [...row, ""]) })} variant="secondary"><Plus aria-hidden size={14} />열 추가</ActionButton>
          <ActionButton className="doc-inline-action" disabled={block.rows.length <= 1} onClick={() => onChange({ ...block, rows: block.rows.slice(0, -1) })} variant="secondary"><Minus aria-hidden size={14} />마지막 행 제거</ActionButton>
          <ActionButton className="doc-inline-action" disabled={(block.rows[0]?.length ?? 0) <= 1} onClick={() => onChange({ ...block, rows: block.rows.map((row) => row.slice(0, -1)) })} variant="secondary"><Minus aria-hidden size={14} />마지막 열 제거</ActionButton>
        </div>
      </div>
    );
  }

  if (block.type === "callout") {
    return (
      <div className="doc-block__body">
        <div className="doc-callout-row">
          <input className="doc-callout-icon" maxLength={4} placeholder="💡" value={block.icon} onChange={(event) => onChange({ ...block, icon: event.target.value })} />
          <textarea placeholder="강조해서 남길 문맥" rows={3} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
        </div>
      </div>
    );
  }

  const rows = block.type === "paragraph" ? 5 : block.type === "quote" ? 3 : 2;
  return (
    <div className="doc-block__body">
      <textarea placeholder={block.type.startsWith("heading") ? "제목 입력" : block.type === "quote" ? "인용할 문장" : "내용 입력"} rows={rows} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
      <div className="doc-block__quick-add">
        <button onClick={() => onAddBelow("paragraph")} type="button">본문</button>
        <button onClick={() => onAddBelow("toggle")} type="button">토글</button>
        <button onClick={() => onAddBelow("image")} type="button">이미지</button>
        <button onClick={() => onAddBelow("table")} type="button">표</button>
      </div>
    </div>
  );
}

function ChecklistRow({ item, onChange, onRemove }: { item: DocumentChecklistItem; onChange: (nextItem: DocumentChecklistItem) => void; onRemove: () => void }) {
  return (
    <div className="doc-checklist__row">
      <label><input checked={item.checked} type="checkbox" onChange={(event) => onChange({ ...item, checked: event.target.checked })} /></label>
      <input placeholder="체크할 내용" value={item.text} onChange={(event) => onChange({ ...item, text: event.target.value })} />
      <IconButton label="항목 삭제" onClick={onRemove} size="sm" tone="ghost"><Trash2 aria-hidden size={14} /></IconButton>
    </div>
  );
}

