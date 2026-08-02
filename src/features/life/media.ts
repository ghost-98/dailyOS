import type { LifeMediaUploadInput, LifePhotoRecord } from "@/types/domain";

export type LifeMediaPreview = LifeMediaUploadInput & {
  id: string;
  lastModified: number;
  mimeType: string;
  name: string;
  objectUrl: string;
  sizeBytes: number;
};

export async function createLifeMediaPreview(file: File): Promise<LifeMediaPreview> {
  const objectUrl = URL.createObjectURL(file);
  const basePreview = {
    file,
    id: `${file.name}-${file.lastModified}-${file.size}`,
    lastModified: file.lastModified,
    mimeType: file.type,
    name: file.name,
    objectUrl,
    sizeBytes: file.size,
  };

  if (file.type.startsWith("image/")) {
    const dimensions = await readImageDimensions(objectUrl);
    return { ...basePreview, ...dimensions };
  }

  if (file.type.startsWith("video/")) {
    const metadata = await readVideoMetadata(objectUrl);
    return { ...basePreview, ...metadata };
  }

  return basePreview;
}

export function getMediaFigureStyle(media: Pick<LifePhotoRecord, "height" | "width">) {
  return media.width && media.height ? { aspectRatio: `${media.width} / ${media.height}` } : undefined;
}

export function formatMediaMeta(media: Pick<LifeMediaPreview, "durationSeconds" | "height" | "lastModified" | "mimeType" | "sizeBytes" | "width">) {
  const dimensions = media.width && media.height ? `${media.width}×${media.height}` : null;
  const duration = typeof media.durationSeconds === "number" ? formatDuration(media.durationSeconds) : null;
  const takenAt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(media.lastModified));
  return [media.mimeType, dimensions, duration, formatFileSize(media.sizeBytes), takenAt].filter(Boolean).join(" · ");
}

export function formatStoredMediaMeta(media: LifePhotoRecord) {
  const dimensions = media.width && media.height ? `${media.width}×${media.height}` : null;
  const duration = typeof media.durationSeconds === "number" ? formatDuration(media.durationSeconds) : null;
  const takenAt = media.takenAt ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(media.takenAt)) : null;
  return [media.mimeType, dimensions, duration, typeof media.sizeBytes === "number" ? formatFileSize(media.sizeBytes) : null, takenAt].filter(Boolean).join(" · ");
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes}B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readImageDimensions(objectUrl: string) {
  return new Promise<Pick<LifeMediaPreview, "height" | "width">>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth });
    image.onerror = reject;
    image.src = objectUrl;
  });
}

function readVideoMetadata(objectUrl: string) {
  return new Promise<Pick<LifeMediaPreview, "durationSeconds" | "height" | "width">>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve({ durationSeconds: video.duration, height: video.videoHeight || undefined, width: video.videoWidth || undefined });
    video.onerror = reject;
    video.src = objectUrl;
  });
}
