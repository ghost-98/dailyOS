"use client";

import { FilePlus2, NotebookPen, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { FormField } from "@/components/ui/FormField";
import { SectionCard } from "@/components/ui/SectionCard";
import { DocumentBlockEditor } from "@/features/documents/DocumentBlockEditor";
import { createDocumentInDb, deleteDocumentFromDb, deleteDocumentStorageFiles, fetchDocumentsFromDb, updateDocumentInDb, uploadDocumentImageToDb } from "@/features/documents/api";
import type { DocumentBlock, DocumentImageAsset, DocumentRecord } from "@/features/documents/types";
import { collectDocumentFilePathsFromBlocks, createDocumentBlock, moveArrayItem, summarizeDocument } from "@/features/documents/utils";
import { confirmAction } from "@/lib/actionGuards";

export function DocumentsView() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

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
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return documents;
    return documents.filter((document) => [document.title, document.summary].filter(Boolean).some((value) => value?.toLowerCase().includes(keyword)));
  }, [documents, query]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? null,
    [documents, selectedId],
  );

  const patchSelectedDocument = (updater: (document: DocumentRecord) => DocumentRecord) => {
    setDocuments((current) => current.map((document) => document.id === selectedId ? updater(document) : document));
  };

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
      setMessage("새 문서를 만들었어요.");
    } catch (error) {
      console.error(error);
      setMessage("문서를 만들지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveSelectedDocument = async () => {
    if (!selectedDocument) return;
    setIsSaving(true);
    setMessage("");
    try {
      const saved = await updateDocumentInDb({
        ...selectedDocument,
        summary: summarizeDocument(selectedDocument.title, selectedDocument.content),
        title: selectedDocument.title.trim() || "제목 없는 문서",
      });
      if (!saved) {
        setMessage("문서를 저장하려면 로그인 상태와 Supabase 연결이 필요해요.");
        return;
      }
      setDocuments((current) => [saved, ...current.filter((document) => document.id !== saved.id)]);
      setSelectedId(saved.id);
      setMessage("문서를 저장했어요.");
    } catch (error) {
      console.error(error);
      setMessage("문서를 저장하지 못했어요.");
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
        content: document.content.map((block) => block.id === blockId && block.type === "image" ? { ...block, image: uploadedImage } : block),
      }));
      setMessage("이미지를 올렸어요. 저장 버튼을 누르면 문서에 반영됩니다.");
    } catch (error) {
      console.error(error);
      setMessage("이미지를 업로드하지 못했어요.");
    } finally {
      setIsUploading(false);
    }
  };

  const addBlock = (type: DocumentBlock["type"], index: number) => {
    patchSelectedDocument((document) => {
      const nextBlock = createDocumentBlock(type);
      const insertionIndex = Math.max(0, index + 1);
      const content = [...document.content];
      content.splice(insertionIndex, 0, nextBlock);
      return { ...document, content };
    });
  };

  const updateBlock = (blockId: string, nextBlock: DocumentBlock) => {
    patchSelectedDocument((document) => ({
      ...document,
      content: document.content.map((block) => block.id === blockId ? nextBlock : block),
    }));
  };

  const removeBlock = async (blockId: string) => {
    if (!selectedDocument) return;
    const targetBlock = selectedDocument.content.find((block) => block.id === blockId);
    if (targetBlock?.type === "image" && targetBlock.image?.filePath) {
      await deleteDocumentStorageFiles([targetBlock.image.filePath]);
    }
    patchSelectedDocument((document) => {
      const filtered = document.content.filter((block) => block.id !== blockId);
      return { ...document, content: filtered.length > 0 ? filtered : [createDocumentBlock("paragraph")] };
    });
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    patchSelectedDocument((document) => ({
      ...document,
      content: moveArrayItem(document.content, fromIndex, toIndex),
    }));
  };

  const selectedDocumentImageCount = selectedDocument ? collectDocumentFilePathsFromBlocks(selectedDocument.content).length : 0;

  return (
    <div className="documents-page">
      <header className="life-tab-heading documents-header ui-toolbar-panel">
        <div>
          <p className="eyebrow">문서</p>
          <h1>문서</h1>
          <p>장소 탭과 설정 탭 사이에서, 생각과 정보와 회고를 노션형 블록으로 쌓아두는 공간입니다.</p>
        </div>
        <div className="header-actions">
          <ActionButton disabled={isSaving} onClick={() => void createDocument()}>
            <FilePlus2 aria-hidden size={16} />
            새 문서
          </ActionButton>
        </div>
      </header>

      <div className="documents-layout ui-workspace-grid ui-workspace-grid--sidebar">
        <SectionCard className="documents-sidebar ui-workspace-panel">
          <div className="documents-search">
            <Search aria-hidden size={16} />
            <input placeholder="문서 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="documents-sidebar__summary">
            <span>전체 문서</span>
            <strong>{documents.length}개</strong>
            <p>검색 결과 {filteredDocuments.length}개 · 이미지 {selectedDocumentImageCount}개</p>
          </div>
          <div className="documents-list">
            {filteredDocuments.length > 0 ? filteredDocuments.map((document) => (
              <button className={document.id === selectedId ? "documents-list__item documents-list__item--active" : "documents-list__item"} key={document.id} onClick={() => setSelectedId(document.id)} type="button">
                <div className="documents-list__icon">{document.icon?.trim() || "📝"}</div>
                <div>
                  <strong>{document.title || "제목 없는 문서"}</strong>
                  <p>{document.summary?.trim() || "아직 요약이 없습니다."}</p>
                  <span>{formatDateTime(document.updatedAt ?? document.createdAt)}</span>
                </div>
              </button>
            )) : (
              <div className="documents-empty">
                <strong>{isLoading ? "문서를 불러오는 중..." : "아직 문서가 없어요."}</strong>
                <p>{isLoading ? "잠시만 기다려 주세요." : "첫 문서를 만들어 문맥과 아이디어를 쌓아보세요."}</p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard className="documents-editor ui-workspace-panel">
          {selectedDocument ? (
            <>
              <div className="documents-editor__top">
                <FormField label="문서 아이콘">
                  <input className="documents-icon-input" maxLength={4} placeholder="📝" value={selectedDocument.icon ?? ""} onChange={(event) => patchSelectedDocument((document) => ({ ...document, icon: event.target.value }))} />
                </FormField>
                <FormField label="문서 제목">
                  <input placeholder="문서 제목" value={selectedDocument.title} onChange={(event) => patchSelectedDocument((document) => ({ ...document, title: event.target.value }))} />
                </FormField>
              </div>

              <div className="documents-editor__meta">
                <span>블록 {selectedDocument.content.length}개</span>
                <span>이미지 {selectedDocumentImageCount}개</span>
                <span>{selectedDocument.updatedAt ? `최근 저장 ${formatDateTime(selectedDocument.updatedAt)}` : "아직 저장 전"}</span>
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

              <FormActionBar
                cancelDisabled={isSaving}
                cancelLabel="문서 삭제"
                className="documents-editor__actions"
                onCancel={() => void deleteSelectedDocument()}
                onSubmit={() => void saveSelectedDocument()}
                submitDisabled={isSaving || isUploading}
                submitLabel={isSaving ? "저장 중..." : "문서 저장"}
              />
            </>
          ) : (
            <div className="documents-empty documents-empty--large">
              <NotebookPen aria-hidden size={22} />
              <strong>선택된 문서가 없어요.</strong>
              <p>왼쪽에서 문서를 고르거나 새 문서를 만들어 시작해 보세요.</p>
              <ActionButton disabled={isSaving} onClick={() => void createDocument()}>
                <FilePlus2 aria-hidden size={16} />
                첫 문서 만들기
              </ActionButton>
            </div>
          )}

          {message ? <p className="documents-message">{message}</p> : null}
        </SectionCard>
      </div>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "방금";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금";
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
  }).format(date);
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
