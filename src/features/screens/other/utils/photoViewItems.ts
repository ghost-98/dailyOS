import type { DayPhotoItem } from "@/features/screens/day/dayDetailTypes";
import type { LifePhotoRecord } from "@/types/domain";

export function toDayPhotoItem(photo: LifePhotoRecord): DayPhotoItem {
  const takenAt = photo.takenAt ? new Date(photo.takenAt) : null;
  const sortMinutes = takenAt && !Number.isNaN(takenAt.getTime()) ? takenAt.getHours() * 60 + takenAt.getMinutes() : 0;
  return {
    external: {
      caption: photo.caption,
      date: photo.date,
      fileUrl: photo.fileUrl,
      height: photo.height,
      id: photo.id,
      linkedTargetId: photo.linkedTargetId,
      linkedTargetTitle: photo.linkedTargetTitle,
      linkedTargetType: photo.linkedTargetType,
      meta: photo.caption || photo.fileName,
      mimeType: photo.mimeType,
      placeLatitude: photo.latitude,
      placeLongitude: photo.longitude,
      takenAt: photo.takenAt,
      title: "사진 기록",
      type: "photo",
      width: photo.width,
    },
    id: `photo-${photo.id}`,
    sortMinutes,
    timeLabel: photo.takenAt || photo.date,
    type: "photo",
  };
}
