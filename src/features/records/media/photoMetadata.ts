import type { LifeMediaUploadInput } from "@/types/domain";

type ExifMetadata = {
  latitude?: number;
  longitude?: number;
  takenAt?: string;
};

type ImageMetadata = {
  height?: number;
  width?: number;
};

type VideoMetadata = {
  durationSeconds?: number;
  height?: number;
  width?: number;
};

export async function createLifeMediaUploadInput(file: File): Promise<LifeMediaUploadInput> {
  const [visualMetadata, exifMetadata] = await Promise.all([
    readVisualMetadata(file),
    readExifMetadata(file),
  ]);

  return {
    file,
    ...visualMetadata,
    ...exifMetadata,
  };
}

async function readVisualMetadata(file: File): Promise<ImageMetadata | VideoMetadata> {
  if (file.type.startsWith("image/")) return readImageMetadata(file);
  if (file.type.startsWith("video/")) return readVideoMetadata(file);
  return {};
}

function readImageMetadata(file: File): Promise<ImageMetadata> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ height: image.naturalHeight || undefined, width: image.naturalWidth || undefined });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    image.src = url;
  });
}

function readVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
        height: video.videoHeight || undefined,
        width: video.videoWidth || undefined,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    video.src = url;
  });
}

async function readExifMetadata(file: File): Promise<ExifMetadata> {
  if (!isJpeg(file)) return {};

  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0xffd8) return {};

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return {};
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2, false);
      if (marker === 0xe1 && hasExifHeader(view, offset + 4)) {
        return parseExif(view, offset + 10);
      }
      offset += 2 + size;
    }
  } catch {
    return {};
  }

  return {};
}

function isJpeg(file: File) {
  const lowerName = file.name.toLowerCase();
  return file.type === "image/jpeg" || file.type === "image/jpg" || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg");
}

function hasExifHeader(view: DataView, offset: number) {
  return (
    view.getUint8(offset) === 0x45 &&
    view.getUint8(offset + 1) === 0x78 &&
    view.getUint8(offset + 2) === 0x69 &&
    view.getUint8(offset + 3) === 0x66 &&
    view.getUint8(offset + 4) === 0x00 &&
    view.getUint8(offset + 5) === 0x00
  );
}

function parseExif(view: DataView, tiffStart: number): ExifMetadata {
  const littleEndian = view.getUint16(tiffStart, false) === 0x4949;
  const firstIfdOffset = readUint32(view, tiffStart + 4, littleEndian);
  const ifd = readIfd(view, tiffStart + firstIfdOffset, tiffStart, littleEndian);
  const exifIfdOffset = getSingleNumber(ifd.get(0x8769));
  const gpsIfdOffset = getSingleNumber(ifd.get(0x8825));
  const exifIfd = exifIfdOffset ? readIfd(view, tiffStart + exifIfdOffset, tiffStart, littleEndian) : new Map<number, unknown>();
  const gpsIfd = gpsIfdOffset ? readIfd(view, tiffStart + gpsIfdOffset, tiffStart, littleEndian) : new Map<number, unknown>();
  const takenAt = parseExifDate(getStringValue(exifIfd.get(0x9003)) ?? getStringValue(ifd.get(0x0132)));
  const coordinates = parseGpsCoordinates(gpsIfd);
  return { takenAt, ...coordinates };
}

function readIfd(view: DataView, offset: number, tiffStart: number, littleEndian: boolean) {
  const entries = new Map<number, unknown>();
  if (offset <= 0 || offset + 2 > view.byteLength) return entries;
  const count = readUint16(view, offset, littleEndian);

  for (let index = 0; index < count; index += 1) {
    const entryOffset = offset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = readUint16(view, entryOffset, littleEndian);
    const type = readUint16(view, entryOffset + 2, littleEndian);
    const valueCount = readUint32(view, entryOffset + 4, littleEndian);
    const valueOffset = getValueOffset(view, entryOffset, tiffStart, type, valueCount, littleEndian);
    entries.set(tag, readValue(view, valueOffset, type, valueCount, littleEndian));
  }

  return entries;
}

function getValueOffset(view: DataView, entryOffset: number, tiffStart: number, type: number, count: number, littleEndian: boolean) {
  const valueBytes = getTypeSize(type) * count;
  if (valueBytes <= 4) return entryOffset + 8;
  return tiffStart + readUint32(view, entryOffset + 8, littleEndian);
}

function readValue(view: DataView, offset: number, type: number, count: number, littleEndian: boolean): unknown {
  if (offset < 0 || offset >= view.byteLength) return undefined;
  if (type === 2) return readAscii(view, offset, count);
  if (type === 3) return readNumberList(view, offset, count, 2, littleEndian);
  if (type === 4) return readNumberList(view, offset, count, 4, littleEndian);
  if (type === 5) return readRationalList(view, offset, count, littleEndian);
  return undefined;
}

function readAscii(view: DataView, offset: number, count: number) {
  const bytes: number[] = [];
  for (let index = 0; index < count && offset + index < view.byteLength; index += 1) {
    const byte = view.getUint8(offset + index);
    if (byte === 0) break;
    bytes.push(byte);
  }
  return String.fromCharCode(...bytes);
}

function readNumberList(view: DataView, offset: number, count: number, size: 2 | 4, littleEndian: boolean) {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const cursor = offset + index * size;
    if (cursor + size > view.byteLength) break;
    values.push(size === 2 ? readUint16(view, cursor, littleEndian) : readUint32(view, cursor, littleEndian));
  }
  return values;
}

function readRationalList(view: DataView, offset: number, count: number, littleEndian: boolean) {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const cursor = offset + index * 8;
    if (cursor + 8 > view.byteLength) break;
    const numerator = readUint32(view, cursor, littleEndian);
    const denominator = readUint32(view, cursor + 4, littleEndian);
    values.push(denominator ? numerator / denominator : 0);
  }
  return values;
}

function parseGpsCoordinates(gpsIfd: Map<number, unknown>): Pick<ExifMetadata, "latitude" | "longitude"> {
  const latitudeRef = getStringValue(gpsIfd.get(0x0001));
  const latitudeValues = getNumberList(gpsIfd.get(0x0002));
  const longitudeRef = getStringValue(gpsIfd.get(0x0003));
  const longitudeValues = getNumberList(gpsIfd.get(0x0004));
  if (!latitudeRef || !longitudeRef || latitudeValues.length < 3 || longitudeValues.length < 3) return {};

  const latitude = toDecimalDegrees(latitudeValues, latitudeRef);
  const longitude = toDecimalDegrees(longitudeValues, longitudeRef);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
  return { latitude, longitude };
}

function toDecimalDegrees(values: number[], ref: string) {
  const decimal = values[0] + values[1] / 60 + values[2] / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
}

function parseExifDate(value?: string) {
  const match = value?.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`).toISOString();
}

function getSingleNumber(value: unknown) {
  const values = getNumberList(value);
  return values[0];
}

function getNumberList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
}

function getStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function readUint16(view: DataView, offset: number, littleEndian: boolean) {
  return view.getUint16(offset, littleEndian);
}

function readUint32(view: DataView, offset: number, littleEndian: boolean) {
  return view.getUint32(offset, littleEndian);
}

function getTypeSize(type: number) {
  return { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 }[type as 1 | 2 | 3 | 4 | 5] ?? 0;
}
