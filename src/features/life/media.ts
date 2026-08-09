import type { LifeMediaUploadInput, LifePhotoRecord } from "@/types/domain";

export type LifeMediaPreview = LifeMediaUploadInput & {
  id: string;
  lastModified: number;
  mimeType: string;
  name: string;
  objectUrl: string;
  sizeBytes: number;
};

type ExifValue = number | number[] | string;

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
    const [dimensions, exifMetadata] = await Promise.all([readImageDimensions(objectUrl), readImageExifMetadata(file)]);
    return { ...basePreview, ...dimensions, ...exifMetadata };
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

export function formatMediaMeta(
  media: Pick<LifeMediaPreview, "durationSeconds" | "height" | "lastModified" | "mimeType" | "sizeBytes" | "takenAt" | "width">,
) {
  const dimensions = media.width && media.height ? `${media.width}횞${media.height}` : null;
  const duration = typeof media.durationSeconds === "number" ? formatDuration(media.durationSeconds) : null;
  const takenAtSource = media.takenAt ?? new Date(media.lastModified).toISOString();
  const takenAt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(takenAtSource));
  return [media.mimeType, dimensions, duration, formatFileSize(media.sizeBytes), takenAt].filter(Boolean).join(" 쨌 ");
}

export function formatStoredMediaMeta(media: LifePhotoRecord) {
  const dimensions = media.width && media.height ? `${media.width}횞${media.height}` : null;
  const duration = typeof media.durationSeconds === "number" ? formatDuration(media.durationSeconds) : null;
  const takenAt = media.takenAt ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(media.takenAt)) : null;
  return [media.mimeType, dimensions, duration, typeof media.sizeBytes === "number" ? formatFileSize(media.sizeBytes) : null, takenAt].filter(Boolean).join(" 쨌 ");
}

export function formatMediaMetaLines(
  media: Pick<LifeMediaPreview, "durationSeconds" | "height" | "lastModified" | "mimeType" | "sizeBytes" | "takenAt" | "width">,
) {
  const takenAtSource = media.takenAt ?? new Date(media.lastModified).toISOString();
  return [
    media.mimeType || "이미지",
    media.width && media.height ? `${media.width} × ${media.height}` : null,
    typeof media.sizeBytes === "number" ? formatFileSize(media.sizeBytes) : null,
    typeof media.durationSeconds === "number" ? formatDuration(media.durationSeconds) : null,
    new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(takenAtSource)),
  ].filter(Boolean);
}

export function formatStoredMediaMetaLines(media: LifePhotoRecord) {
  return [
    media.mimeType || "이미지",
    media.width && media.height ? `${media.width} × ${media.height}` : null,
    typeof media.sizeBytes === "number" ? formatFileSize(media.sizeBytes) : null,
    typeof media.durationSeconds === "number" ? formatDuration(media.durationSeconds) : null,
    media.takenAt ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(media.takenAt)) : null,
  ].filter(Boolean);
}

export function hasGeoMetadata(media: Pick<LifePhotoRecord, "latitude" | "longitude"> | Pick<LifeMediaPreview, "latitude" | "longitude">) {
  return typeof media.latitude === "number" && Number.isFinite(media.latitude) && typeof media.longitude === "number" && Number.isFinite(media.longitude);
}

export function formatGeoMetadata(media: Pick<LifePhotoRecord, "latitude" | "longitude"> | Pick<LifeMediaPreview, "latitude" | "longitude">) {
  if (!hasGeoMetadata(media)) return null;
  return `GPS ${media.latitude!.toFixed(5)}, ${media.longitude!.toFixed(5)}`;
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

async function readImageExifMetadata(file: File): Promise<Pick<LifeMediaPreview, "latitude" | "longitude" | "takenAt">> {
  if (file.type !== "image/jpeg" && file.type !== "image/jpg") return {};

  try {
    const buffer = await file.arrayBuffer();
    return parseJpegExif(buffer);
  } catch (error) {
    console.error("Failed to parse image EXIF metadata", error);
    return {};
  }
}

function parseJpegExif(buffer: ArrayBuffer): Pick<LifeMediaPreview, "latitude" | "longitude" | "takenAt"> {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return {};

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;

    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2) break;

    if (marker === 0xe1 && offset + 2 + segmentLength <= view.byteLength) {
      const exifStart = offset + 4;
      if (readAscii(view, exifStart, 4) === "Exif") {
        return parseExifPayload(view, exifStart + 6);
      }
    }

    offset += segmentLength + 2;
  }

  return {};
}

function parseExifPayload(view: DataView, tiffStart: number): Pick<LifeMediaPreview, "latitude" | "longitude" | "takenAt"> {
  if (tiffStart + 8 > view.byteLength) return {};

  const byteOrder = readAscii(view, tiffStart, 2);
  const isLittleEndian = byteOrder === "II";
  if (!isLittleEndian && byteOrder !== "MM") return {};
  if (view.getUint16(tiffStart + 2, isLittleEndian) !== 42) return {};

  const ifd0Offset = view.getUint32(tiffStart + 4, isLittleEndian);
  const ifd0 = parseIfd(view, tiffStart, tiffStart + ifd0Offset, isLittleEndian);
  const exifIfdOffset = getSingleNumber(ifd0.get(0x8769));
  const gpsIfdOffset = getSingleNumber(ifd0.get(0x8825));

  const exifIfd = exifIfdOffset ? parseIfd(view, tiffStart, tiffStart + exifIfdOffset, isLittleEndian) : new Map<number, ExifValue>();
  const gpsIfd = gpsIfdOffset ? parseIfd(view, tiffStart, tiffStart + gpsIfdOffset, isLittleEndian) : new Map<number, ExifValue>();

  const takenAt =
    parseExifDate(getStringValue(exifIfd.get(0x9003))) ??
    parseExifDate(getStringValue(exifIfd.get(0x9004))) ??
    parseExifDate(getStringValue(ifd0.get(0x0132)));

  const latitude = parseGpsCoordinate(gpsIfd.get(0x0001), gpsIfd.get(0x0002));
  const longitude = parseGpsCoordinate(gpsIfd.get(0x0003), gpsIfd.get(0x0004));

  return { latitude, longitude, takenAt };
}

function parseIfd(view: DataView, tiffStart: number, ifdOffset: number, isLittleEndian: boolean) {
  const entries = new Map<number, ExifValue>();
  if (ifdOffset + 2 > view.byteLength) return entries;

  const entryCount = view.getUint16(ifdOffset, isLittleEndian);
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, isLittleEndian);
    const type = view.getUint16(entryOffset + 2, isLittleEndian);
    const count = view.getUint32(entryOffset + 4, isLittleEndian);
    const value = readExifValue(view, tiffStart, entryOffset + 8, type, count, isLittleEndian);
    if (value !== undefined) entries.set(tag, value);
  }

  return entries;
}

function readExifValue(
  view: DataView,
  tiffStart: number,
  valueOffset: number,
  type: number,
  count: number,
  isLittleEndian: boolean,
): ExifValue | undefined {
  const typeSize = getExifTypeSize(type);
  if (!typeSize || count <= 0) return undefined;

  const totalSize = typeSize * count;
  const dataOffset = totalSize <= 4 ? valueOffset : tiffStart + view.getUint32(valueOffset, isLittleEndian);
  if (dataOffset < 0 || dataOffset + totalSize > view.byteLength) return undefined;

  switch (type) {
    case 2:
      return readAscii(view, dataOffset, count).replace(/\0+$/, "").trim();
    case 3:
      return readNumberArray(count, (index) => view.getUint16(dataOffset + index * 2, isLittleEndian));
    case 4:
      return readNumberArray(count, (index) => view.getUint32(dataOffset + index * 4, isLittleEndian));
    case 5:
      return readNumberArray(count, (index) => {
        const numerator = view.getUint32(dataOffset + index * 8, isLittleEndian);
        const denominator = view.getUint32(dataOffset + index * 8 + 4, isLittleEndian);
        return denominator === 0 ? 0 : numerator / denominator;
      });
    default:
      return undefined;
  }
}

function getExifTypeSize(type: number) {
  switch (type) {
    case 2:
      return 1;
    case 3:
      return 2;
    case 4:
      return 4;
    case 5:
      return 8;
    default:
      return 0;
  }
}

function readNumberArray(count: number, reader: (index: number) => number) {
  const values = Array.from({ length: count }, (_, index) => reader(index));
  return values.length === 1 ? values[0] : values;
}

function parseExifDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return undefined;

  const [, year, month, day, hours, minutes, seconds] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseGpsCoordinate(referenceValue?: ExifValue, coordinateValue?: ExifValue) {
  const reference = getStringValue(referenceValue);
  const coordinates = Array.isArray(coordinateValue) ? coordinateValue : typeof coordinateValue === "number" ? [coordinateValue] : [];
  if (!reference || coordinates.length < 3) return undefined;

  const [degrees, minutes, seconds] = coordinates;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return reference === "S" || reference === "W" ? -decimal : decimal;
}

function getStringValue(value?: ExifValue) {
  return typeof value === "string" ? value : undefined;
}

function getSingleNumber(value?: ExifValue) {
  if (typeof value === "number") return value;
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  return undefined;
}

function readAscii(view: DataView, start: number, length: number) {
  let result = "";
  for (let index = 0; index < length && start + index < view.byteLength; index += 1) {
    result += String.fromCharCode(view.getUint8(start + index));
  }
  return result;
}
