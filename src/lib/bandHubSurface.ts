import { CalendarDays, HardDrive } from 'lucide-react';
import { getCategory, type DriveFile } from '@/lib/googleDrive';

export const BAND_HUB_TABS = [
  {
    id: 'kalender',
    label: 'Kalender',
    eyebrow: 'Kalender',
    title: 'Rep, svar, check-in',
    desc: '',
    icon: CalendarDays,
  },
  {
    id: 'drive',
    label: 'Drive',
    eyebrow: 'Drive',
    title: 'Inspelningar, dokument, bilder',
    desc: '',
    icon: HardDrive,
  },
] as const;

export const DRIVE_FILTERS = [
  { id: 'alla', label: 'Alla' },
  { id: 'fasta', label: 'Fästa' },
  { id: 'inspelningar', label: 'Inspelningar' },
  { id: 'dokument', label: 'Dokument' },
  { id: 'bilder', label: 'Bilder' },
  { id: 'ovrigt', label: 'Övrigt' },
] as const;

export type BandHubTabId = (typeof BAND_HUB_TABS)[number]['id'];
export type DriveFilterId = (typeof DRIVE_FILTERS)[number]['id'];

export function formatRelativeDriveDate(dateStr?: string): string {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Uppdaterad nyligen';
  if (diffHours < 24) return `Uppdaterad ${diffHours}h sedan`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 7) return `Uppdaterad ${diffDays}d sedan`;
  return `Uppdaterad ${new Date(dateStr).toLocaleDateString('sv-SE')}`;
}

export function formatFileSize(size?: string): string {
  const value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const rounded = current >= 10 || unitIndex === 0 ? Math.round(current) : Math.round(current * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

export function getDriveSurfaceModel(
  files: DriveFile[],
  pinnedIds: string[],
  driveFilter: DriveFilterId
) {
  const pinnedFiles = files.filter((file) => pinnedIds.includes(file.id));
  const categoryCounts = files.reduce<Record<string, number>>((acc, file) => {
    const category = getCategory(file);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const filteredFiles = driveFilter === 'alla'
    ? files
    : driveFilter === 'fasta'
      ? pinnedFiles
      : files.filter((file) => getCategory(file) === driveFilter);

  return {
    driveStats: {
      total: files.length,
      pinned: pinnedFiles.length,
      categoryCounts,
      latestModified: files[0]?.modifiedTime || null,
    },
    filteredFiles,
    featuredFiles: filteredFiles.filter((file) => pinnedIds.includes(file.id)),
    flowFiles: filteredFiles.filter((file) => !pinnedIds.includes(file.id)),
    latestRecording: files.find((file) => getCategory(file) === 'inspelningar') || null,
    latestDocument: files.find((file) => getCategory(file) === 'dokument') || null,
    latestImage: files.find((file) => getCategory(file) === 'bilder') || null,
  };
}

export function getDriveEmptyMessage(driveFilter: DriveFilterId): string {
  if (driveFilter === 'fasta') return 'Inget fäst just nu.';
  if (driveFilter === 'alla') return 'Tomt i Drive just nu.';
  return `Tomt under ${DRIVE_FILTERS.find((filter) => filter.id === driveFilter)?.label?.toLowerCase()}.`;
}
