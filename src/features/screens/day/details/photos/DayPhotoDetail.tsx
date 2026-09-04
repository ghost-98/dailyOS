"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { getTimelineTimeLabel } from "@/features/calendar/calendarViewHelpers";
import { getLinkedTargetTypeLabel } from "@/features/records/format/recordFormatters";
import type { DayItemActions, DayPhotoItem } from "@/features/screens/day/dayDetailTypes";

type DayPhotoDetailProps = {
  actions?: DayItemActions;
  isLoading: boolean;
  items: DayPhotoItem[];
};

export function DayPhotoDetail({ actions, isLoading, items }: DayPhotoDetailProps) {
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const scrollRafRef = useRef<number | null>(null);
  const sortedItems = useMemo(() => [...items].sort((left, right) => getPhotoSortMinutes(left) - getPhotoSortMinutes(right)), [items]);
  const [currentId, setCurrentId] = useState<string | null>(sortedItems[0]?.id ?? null);
  const [flippedId, setFlippedId] = useState<string | null>(null);

  useEffect(() => {
    const firstId = sortedItems[0]?.id ?? null;
    setCurrentId((current) => (current && sortedItems.some((item) => item.id === current) ? current : firstId));
    setFlippedId((current) => (current && sortedItems.some((item) => item.id === current) ? current : null));
  }, [sortedItems]);

  useEffect(() => () => {
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
  }, []);

  useEffect(() => {
    if (currentId) itemRefs.current.get(currentId)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentId]);

  const currentIndex = currentId ? sortedItems.findIndex((item) => item.id === currentId) : -1;

  return (
    <div className="life-calendar-day-detail life-calendar-day-photo-view">
      <div className="life-calendar-day-photo-counter">
        <span>{currentIndex >= 0 ? `${currentIndex + 1} / ${sortedItems.length}` : `0 / ${sortedItems.length}`}</span>
      </div>
      <div
        aria-label="사진 기억"
        className="life-calendar-day-photo-carousel"
        onScroll={(event) => {
          const carousel = event.currentTarget;
          if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
          scrollRafRef.current = requestAnimationFrame(() => {
            const center = carousel.scrollLeft + carousel.clientWidth / 2;
            let closestId: string | null = null;
            let closestDistance = Number.POSITIVE_INFINITY;
            itemRefs.current.forEach((element, itemId) => {
              const distance = Math.abs(element.offsetLeft + element.offsetWidth / 2 - center);
              if (distance < closestDistance) {
                closestDistance = distance;
                closestId = itemId;
              }
            });
            if (closestId) {
              setCurrentId(closestId);
              setFlippedId(null);
            }
          });
        }}
      >
        {sortedItems.length > 0 ? (
          sortedItems.map((item) => {
            const isCurrent = currentId === item.id;
            const isFlipped = flippedId === item.id;
            return (
              <article
                aria-pressed={isFlipped}
                className={isFlipped ? "life-calendar-day-photo-card life-calendar-day-photo-card--active" : isCurrent ? "life-calendar-day-photo-card life-calendar-day-photo-card--current" : "life-calendar-day-photo-card"}
                key={item.id}
                onClick={() => {
                  setCurrentId(item.id);
                  setFlippedId((current) => (current === item.id ? null : item.id));
                }}
                ref={(element) => {
                  if (element) itemRefs.current.set(item.id, element);
                  else itemRefs.current.delete(item.id);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="life-calendar-day-photo-card__inner">
                  <div className="life-calendar-day-photo-card__face life-calendar-day-photo-card__face--front">
                    <div className="life-calendar-day-photo-card__media">
                      {item.external.fileUrl ? (
                        item.external.mimeType?.startsWith("video/") ? (
                          <video controls src={item.external.fileUrl} />
                        ) : (
                          <Image alt={item.external.caption || item.external.title} height={item.external.height ?? 480} src={item.external.fileUrl} unoptimized width={item.external.width ?? 480} />
                        )
                      ) : (
                        <div>{item.external.caption || item.external.title}</div>
                      )}
                    </div>
                    <div className="life-calendar-day-photo-card__caption"><span>{formatPhotoTimeLabel(item.external)}</span></div>
                  </div>
                  <div className="life-calendar-day-photo-card__face life-calendar-day-photo-card__face--back">
                    {actions ? <div className="life-calendar-day-photo-card__actions" onClick={(event) => event.stopPropagation()}>
                      <button aria-label="사진 수정" onClick={() => void actions.editPhoto(item.external.id)} type="button"><Pencil aria-hidden size={14} /></button>
                      <button aria-label="사진 삭제" onClick={() => void actions.deletePhoto(item.external.id)} type="button"><Trash2 aria-hidden size={14} /></button>
                    </div> : null}
                    <PhotoInfoSection empty="적어둔 설명이 없어요." lines={getPhotoUserNotes(item)} title="내가 적은 내용" />
                    <PhotoInfoSection empty="연결된 시스템 정보가 없어요." lines={getPhotoSystemNotes(item)} title="시스템 내용" />
                    <PhotoInfoSection empty="메타데이터를 읽을 수 없어요." lines={getPhotoMetadataLines(item)} title="사진 메타데이터" />
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 남은 사진이 아직 없어요."}</div>
        )}
      </div>
    </div>
  );
}

function PhotoInfoSection({ empty, lines, title }: { empty: string; lines: string[]; title: string }) {
  return (
    <section className="life-calendar-day-photo-card__section">
      <strong>{title}</strong>
      <div className="life-calendar-day-photo-card__lines">
        {lines.length > 0 ? lines.map((line) => <p key={`${title}-${line}`}>{line}</p>) : <p>{empty}</p>}
      </div>
    </section>
  );
}

function getPhotoUserNotes(item: DayPhotoItem) {
  return [item.external.caption?.trim() || null].filter(Boolean) as string[];
}

function getPhotoSystemNotes(item: DayPhotoItem) {
  return [
    item.external.linkedTargetTitle ? `${getLinkedTargetTypeLabel(item.external.linkedTargetType)} · ${item.external.linkedTargetTitle}` : null,
    item.external.placeName ? `장소 · ${item.external.placeName}` : null,
    item.external.placeAddress ? `주소 · ${item.external.placeAddress}` : null,
    item.external.meta && item.external.meta !== item.external.caption ? item.external.meta : null,
  ].filter(Boolean) as string[];
}

function getPhotoMetadataLines(item: DayPhotoItem) {
  return [
    formatPhotoTimeLabel(item.external),
    item.external.takenAt ? `촬영일시 · ${formatDateTimeLabel(item.external.takenAt)}` : null,
    item.external.mimeType ? `파일 형식 · ${item.external.mimeType}` : null,
    item.external.width && item.external.height ? `해상도 · ${item.external.width} × ${item.external.height}` : null,
    getPhotoFileName(item),
  ].filter(Boolean) as string[];
}

function getPhotoFileName(item: DayPhotoItem) {
  const source = item.external.fileUrl;
  if (!source) return null;
  const name = source.split("?")[0].split("#")[0].split("/").filter(Boolean).at(-1);
  return name ? `파일 · ${decodeURIComponent(name)}` : null;
}

function getPhotoSortMinutes(item: DayPhotoItem) {
  if (item.external.takenAt) {
    const takenAt = new Date(item.external.takenAt);
    if (!Number.isNaN(takenAt.getTime())) return takenAt.getTime();
  }
  return item.external.startTime ? toTimelineMinutes(item.external.startTime) : Number.POSITIVE_INFINITY;
}

function formatPhotoTimeLabel(photo: DayPhotoItem["external"]) {
  if (photo.takenAt) return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(photo.takenAt));
  return photo.startTime ? getTimelineTimeLabel(photo.startTime, photo.isAllDay) : "기록";
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function toTimelineMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.POSITIVE_INFINITY;
}
