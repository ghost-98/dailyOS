"use client";

import { FilePlus2, NotebookPen, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { FormField } from "@/components/ui/FormField";
import { SectionCard } from "@/components/ui/SectionCard";
import { DocumentBlockEditor } from "@/features/documents/DocumentBlockEditor";
import { createDocumentInDb, deleteDocumentFromDb, deleteDocumentStorageFiles, fetchDocumentsFromDb, updateDocumentInDb, uploadDocumentImageToDb } from "@/features/documents/api";
import type { DocumentBlock, DocumentImageAsset, DocumentRecord } from "@/features/documents/types";
import { collectDocumentFilePathsFromBlocks, createDocumentBlock, moveArrayItem, parseDocumentTags, summarizeDocument } from "@/features/documents/utils";
import { confirmAction } from "@/lib/actionGuards";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function DocumentsView() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchDocumentsFromDb()
      .then((rows) => {
        if (!isMounted) return;
        const nextDocuments = rows ?? [];
        setDocuments(nextDocuments);
        setSelectedId((current) => current ?? nextDocuments[0]?.id ?? null);
      })
      .catch((error) => {
        console.error("Failed to load documents from Supabase", error);
        if (isMounted) setMessage("문서를 불러오지 못했어요. Supabase 스키마와 권한을 확인해 주세요.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
          loadedRef.current = true;
        }
      });

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return documents;
    return documents.filter((document) => {
      const source = [document.title, document.summary, document.folder, ...document.tags].filter(Boolean).join(" ").toLowerCase();
      return source.includes(keyword);
    });
  }, [documents, query]);

  const selectedDocument = useMemo(() => documents.find((document) => document.id === selectedId) ?? null, [documents, selectedId]);
  const folderOptions = useMemo(() => [...new Set(documents.map((document) => document.folder?.trim()).filter(Boolean))], [documents]);
  const selectedDocumentImageCount = selectedDocument ? collectDocumentFilePathsFromBlocks(selectedDocument.content).length : 0;

  useEffect(() => {
    setTagInput(selectedDocument?.tags.join(", ") ?? "");
  }, [selectedDocument?.id, selectedDocument?.tags]);

  const patchSelectedDocument = (updater: (document: DocumentRecord) => DocumentRecord) => {
    setDocuments((current) => current.map((document) => document.id === selectedId ? updater(document) : document));
    if (loadedRef.current) setSaveState("dirty");
  };

  const persistDocument = async (document: DocumentRecord, silent = false) => {
    setIsSaving(true);
    setSaveState("saving");
    if (!silent) setMessage("");
    try {
      const saved = await updateDocumentInDb({
        ...document,
        summary: summarizeDocument(document.title, document.content),
        title: document.title.trim() || "제목 없는 문서",
      });
      if (!saved) {
        setSaveState("error");
        if (!silent) setMessage("문서를 저장하려면 로그인 상태와 Supabase 연결이 필요해요.");
        return;
      }
      setDocuments((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedId(saved.id);
      setSaveState("saved");
      if (!silent) setMessage("문서를 저장했어요.");
    } catch (error) {
      console.error(error);
      setSaveState("error");
      if (!silent) setMessage("문서를 저장하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedDocument || saveState !== "dirty") return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void persistDocument(selectedDocument, true);
    }, 900);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [saveState, selectedDocument]);

  const createDocument = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const created = await createDocumentInDb();
      if (!created) {
        setMessage("문서를 만들려면 로그인 상태와 Supabase 연결이 필요해요.");
        return;
      }
      setDocuments((current) => [created, ...current]);
      setSelectedId(created.id);
      setSaveState("idle");
      setMessage("새 문서를 만들었어요.");
    } catch (error) {
      console.error(error);
      setMessage("문서를 만들지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSelectedDocument = async () => {
    if (!selectedDocument) return;
    if (!confirmAction(`"${selectedDocument.title || "제목 없는 문서"}" 문서를 삭제할까요?`)) return;
    setIsSaving(true);
    setMessage("");
    try {
      const deletedId = selectedDocument.id;
      await deleteDocumentFromDb(selectedDocument);
      setDocuments((current) => {
        const remaining = current.filter((document) => document.id !== deletedId);
        setSelectedId((activeId) => activeId === deletedId ? remaining[0]?.id ?? null : activeId);
        return remaining;
      });
      setSaveState("idle");
      setMessage("문서를 삭제했어요.");
    } catch (error) {
      console.error(error);
      setMessage("문서를 삭제하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  };

  const replaceBlockImage = async (blockId: string, file: File, previousImage?: DocumentImageAsset) => {
    if (!selectedDocument) return;
    setIsUploading(true);
    setMessage("");
    try {
      const dimensions = await readImageDimensions(file);
      const uploadedImage = await uploadDocumentImageToDb(file, dimensions);
      if (!uploadedImage) {
        setMessage("이미지를 올리려면 로그인 상태와 Supabase 연결이 필요해요.");
        return;
      }
      if (previousImage?.filePath) await deleteDocumentStorageFiles([previousImage.filePath]);
      patchSelectedDocument((document) => ({
        ...document,
        content: updateBlocks(document.content, blockId, (block) => block.type === "image" ? { ...block, image: uploadedImage } : block),
      }));
      setMessage("이미지를 올렸어요. 자동 저장됩니다.");
    } catch (error) {
      console.error(error);
      setMessage("이미지를 업로드하지 못했어요.");
    } finally {
      setIsUploading(false);
    }
  };

  const addBlock = (type: DocumentBlock["type"], index: number) => {
    patchSelectedDocument((document) => {
      const content = [...document.content];
      content.splice(Math.max(0, index + 1), 0, createDocumentBlock(type));
      return { ...document, content };
    });
  };

  const updateBlock = (blockId: string, nextBlock: DocumentBlock) => {
    patchSelectedDocument((document) => ({ ...document, content: updateBlocks(document.content, blockId, () => nextBlock) }));
  };

  const removeBlock = async (blockId: string) => {
    if (!selectedDocument) return;
    const targetBlock = findBlockById(selectedDocument.content, blockId);
    if (targetBlock?.type === "image" && targetBlock.image?.filePath) await deleteDocumentStorageFiles([targetBlock.image.filePath]);
    patchSelectedDocument((document) => {
      const filtered = removeBlocks(document.content, blockId);
      return { ...document, content: filtered.length > 0 ? filtered : [createDocumentBlock("paragraph")] };
    });
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    patchSelectedDocument((document) => ({ ...document, content: moveArrayItem(document.content, fromIndex, toIndex) }));
  };

  return (
    <div className="documents-page">
      <header className="life-tab-heading documents-header ui-toolbar-panel">
        <div>
          <p className="eyebrow">문서</p>
          <h1>문서</h1>
          <p>노션처럼 문서를 만들되, 우리 서비스의 기록 맥락과 함께 바로 쌓이는 문서 공간으로 확장했어요.</p>
        </div>
        <div className="header-actions">
          <ActionButton disabled={isSaving} onClick={() => void createDocument()}><FilePlus2 aria-hidden size={16} />새 문서</ActionButton>
        </div>
      </header>

      <div className="documents-layout ui-workspace-grid ui-workspace-grid--sidebar">
        <SectionCard className="documents-sidebar ui-workspace-panel">
          <div className="documents-search"><Search aria-hidden size={16} /><input placeholder="문서 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="documents-sidebar__summary">
            <span>전체 문서</span>
            <strong>{documents.length}개</strong>
            <p>폴더 {folderOptions.length}개 · 검색 결과 {filteredDocuments.length}개</p>
          </div>
          <div className="documents-folder-chips">
            {folderOptions.map((folder) => <button key={folder} onClick={() => setQuery(String(folder))} type="button">{folder}</button>)}
          </div>
          <div className="documents-list">
            {filteredDocuments.length > 0 ? filteredDocuments.map((document) => (
              <button className={document.id === selectedId ? "documents-list__item documents-list__item--active" : "documents-list__item"} key={document.id} onClick={() => setSelectedId(document.id)} type="button">
                <div className="documents-list__icon">{document.icon?.trim() || "📝"}</div>
                <div>
                  <strong>{document.title || "제목 없는 문서"}</strong>
                  <p>{document.summary?.trim() || "아직 요약이 없습니다."}</p>
                  <span>{document.folder?.trim() || "미분류"} · {formatDateTime(document.updatedAt ?? document.createdAt)}</span>
                </div>
              </button>
            )) : <div className="documents-empty"><strong>{isLoading ? "문서를 불러오는 중..." : "아직 문서가 없어요."}</strong><p>{isLoading ? "잠시만 기다려 주세요." : "첫 문서를 만들어 문맥과 아이디어를 쌓아보세요."}</p></div>}
          </div>
        </SectionCard>

        <SectionCard className="documents-editor ui-workspace-panel">
          {selectedDocument ? (
            <>
              <div className="documents-editor__top documents-editor__top--meta">
                <FormField label="문서 아이콘"><input className="documents-icon-input" maxLength={4} placeholder="📝" value={selectedDocument.icon ?? ""} onChange={(event) => patchSelectedDocument((document) => ({ ...document, icon: event.target.value }))} /></FormField>
                <FormField label="문서 제목"><input placeholder="문서 제목" value={selectedDocument.title} onChange={(event) => patchSelectedDocument((document) => ({ ...document, title: event.target.value }))} /></FormField>
              </div>

              <div className="documents-editor__top documents-editor__top--meta">
                <FormField label="폴더"><input list="document-folder-options" placeholder="예: 회고, 기획, 운영" value={selectedDocument.folder ?? ""} onChange={(event) => patchSelectedDocument((document) => ({ ...document, folder: event.target.value }))} /></FormField>
                <FormField label="태그"><input placeholder="쉼표로 구분" value={tagInput} onChange={(event) => { setTagInput(event.target.value); patchSelectedDocument((document) => ({ ...document, tags: parseDocumentTags(event.target.value) })); }} /></FormField>
                <datalist id="document-folder-options">{folderOptions.map((folder) => <option key={folder} value={folder} />)}</datalist>
              </div>

              <div className="documents-editor__meta">
                <span>블록 {selectedDocument.content.length}개</span>
                <span>이미지 {selectedDocumentImageCount}개</span>
                <span>태그 {selectedDocument.tags.length}개</span>
                <span>{getSaveStateLabel(saveState)}</span>
              </div>

              <div className="documents-tag-list">
                {selectedDocument.tags.map((tag) => <button key={tag} onClick={() => setQuery(String(tag))} type="button">#{tag}</button>)}
              </div>

              <div className="documents-blocks">
                {selectedDocument.content.map((block, index) => (
                  <DocumentBlockEditor
                    block={block}
                    index={index}
                    isUploading={isUploading}
                    key={block.id}
                    onAddBelow={addBlock}
                    onChange={(nextBlock) => updateBlock(block.id, nextBlock)}
                    onDelete={() => void removeBlock(block.id)}
                    onMoveDown={() => moveBlock(index, Math.min(selectedDocument.content.length - 1, index + 1))}
                    onMoveUp={() => moveBlock(index, Math.max(0, index - 1))}
                    onReplaceImage={(file, previousImage) => replaceBlockImage(block.id, file, previousImage)}
                  />
                ))}
              </div>

              <div className="documents-add-row">
                <ActionButton onClick={() => addBlock("paragraph", selectedDocument.content.length - 1)} variant="secondary">본문 추가</ActionButton>
                <ActionButton onClick={() => addBlock("toggle", selectedDocument.content.length - 1)} variant="secondary">토글 추가</ActionButton>
                <ActionButton onClick={() => addBlock("checklist", selectedDocument.content.length - 1)} variant="secondary">체크리스트 추가</ActionButton>
                <ActionButton onClick={() => addBlock("table", selectedDocument.content.length - 1)} variant="secondary">표 추가</ActionButton>
                <ActionButton onClick={() => addBlock("image", selectedDocument.content.length - 1)} variant="secondary">이미지 추가</ActionButton>
              </div>

              <FormActionBar cancelDisabled={isSaving} cancelLabel="문서 삭제" className="documents-editor__actions" onCancel={() => void deleteSelectedDocument()} onSubmit={() => selectedDocument ? void persistDocument(selectedDocument) : undefined} submitDisabled={isSaving || isUploading} submitLabel={isSaving ? "저장 중..." : "즉시 저장"} />
            </>
          ) : <div className="documents-empty documents-empty--large"><NotebookPen aria-hidden size={22} /><strong>선택된 문서가 없어요.</strong><p>왼쪽에서 문서를 고르거나 새 문서를 만들어 시작해 보세요.</p><ActionButton disabled={isSaving} onClick={() => void createDocument()}><FilePlus2 aria-hidden size={16} />첫 문서 만들기</ActionButton></div>}

          {message ? <p className="documents-message">{message}</p> : null}
        </SectionCard>
      </div>
    </div>
  );
}

function getSaveStateLabel(saveState: SaveState) {
  switch (saveState) {
    case "dirty":
      return "변경됨 · 곧 자동 저장";
    case "saving":
      return "자동 저장 중";
    case "saved":
      return "자동 저장 완료";
    case "error":
      return "자동 저장 실패";
    default:
      return "저장 대기";
  }
}

function findBlockById(content: DocumentBlock[], blockId: string): DocumentBlock | null {
  for (const block of content) {
    if (block.id === blockId) return block;
    if (block.type === "toggle") {
      const nested = findBlockById(block.children, blockId);
      if (nested) return nested;
    }
  }
  return null;
}

function updateBlocks(content: DocumentBlock[], blockId: string, updater: (block: DocumentBlock) => DocumentBlock): DocumentBlock[] {
  return content.map((block) => {
    if (block.id === blockId) return updater(block);
    if (block.type === "toggle") return { ...block, children: updateBlocks(block.children, blockId, updater) };
    return block;
  });
}

function removeBlocks(content: DocumentBlock[], blockId: string): DocumentBlock[] {
  return content.reduce<DocumentBlock[]>((next, block) => {
    if (block.id === blockId) return next;
    if (block.type === "toggle") {
      next.push({ ...block, children: removeBlocks(block.children, blockId) });
      return next;
    }
    next.push(block);
    return next;
  }, []);
}

function formatDateTime(value?: string) {
  if (!value) return "방금";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금";
  return new Intl.DateTimeFormat("ko-KR", { day: "numeric", hour: "2-digit", minute: "2-digit", month: "numeric" }).format(date);
}

async function readImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new window.Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("image-load-failed"));
      nextImage.src = objectUrl;
    });
    return { height: image.naturalHeight, width: image.naturalWidth };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

