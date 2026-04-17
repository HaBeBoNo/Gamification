import { useEffect, useMemo, useState } from 'react';
import {
  fetchPinnedFileIds,
  getDriveFiles,
  subscribePinnedFiles,
  togglePinnedFile,
  uploadFile,
  type DriveFile,
} from '@/lib/googleDrive';
import { supabase } from '@/lib/supabase';
import { S } from '@/state/store';
import { loadToken, type GoogleTokenData } from '@/lib/googleAuth';
import {
  getDriveEmptyMessage,
  getDriveSurfaceModel,
  type DriveFilterId,
} from '@/lib/bandHubSurface';
import { fireAndForget } from '@/lib/async';

export function useDriveSurface(enabled: boolean) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [driveFilter, setDriveFilter] = useState<DriveFilterId>('alla');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [pinMode, setPinMode] = useState<'shared' | 'local'>('local');
  const [googleToken, setGoogleToken] = useState<GoogleTokenData | null>(() => loadToken());

  useEffect(() => {
    if (!enabled) return;
    fireAndForget(loadDriveSurface(), 'load drive surface');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const syncGoogleToken = () => {
      setGoogleToken(loadToken());
    };

    syncGoogleToken();
    window.addEventListener('focus', syncGoogleToken);
    return () => {
      window.removeEventListener('focus', syncGoogleToken);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const channel = subscribePinnedFiles(() => {
      fireAndForget(loadPins(), 'load drive pins');
    });
    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [enabled]);

  async function loadFiles() {
    setLoading(true);
    setError('');
    try {
      const result = await getDriveFiles();
      setFiles(result);
    } catch {
      setError('Kunde inte hämta filer just nu.');
    } finally {
      setLoading(false);
    }
  }

  async function loadPins() {
    try {
      const result = await fetchPinnedFileIds();
      setPinnedIds(result.ids);
      setPinMode(result.source);
    } catch (err: any) {
      console.warn('[BandHub] pin load failed:', err?.message || err);
    }
  }

  async function loadDriveSurface() {
    await Promise.all([loadFiles(), loadPins()]);
  }

  async function handleTogglePin(id: string) {
    const previous = pinnedIds;
    const wasPinned = previous.includes(id);
    const optimistic = wasPinned
      ? previous.filter((p) => p !== id)
      : [...previous, id];
    setPinnedIds(optimistic);

    try {
      const source = await togglePinnedFile(id, wasPinned, S.me);
      setPinMode(source);
    } catch (err: any) {
      setPinnedIds(previous);
      setError(typeof err?.message === 'string' && err.message ? err.message : 'Kunde inte uppdatera fästning.');
    }
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadSuccess('');
    setError('');
    try {
      await uploadFile(file);
      setUploadSuccess(`${file.name} uppladdad!`);
      await loadDriveSurface();
    } catch (err: any) {
      const rawMessage = typeof err?.message === 'string' && err.message
        ? err.message
        : 'Uppladdning misslyckades.';
      const message = /google|token|auth|permission|scope|login|logga in/i.test(rawMessage)
        ? `${rawMessage} Anslut Google ovanför och försök igen.`
        : rawMessage;
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  const surfaceModel = useMemo(
    () => getDriveSurfaceModel(files, pinnedIds, driveFilter),
    [driveFilter, files, pinnedIds]
  );

  return {
    files,
    loading,
    error,
    uploading,
    uploadSuccess,
    driveFilter,
    setDriveFilter,
    pinnedIds,
    pinMode,
    googleToken,
    setGoogleToken,
    loadDriveSurface,
    loadFiles,
    handleTogglePin,
    handleUpload,
    emptyDriveMessage: getDriveEmptyMessage(driveFilter),
    ...surfaceModel,
  };
}
