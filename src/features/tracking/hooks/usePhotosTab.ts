import { useState, useCallback, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { bodyTrackingApi } from "../services";
import { createDeleteHandler } from "../helpers";
import { isoToLocalDateStr } from "../utils";
import { toDateString } from "@utils/format";
import type { ProgressPhoto } from "@shared/types";
import type { ExpandedPhoto } from "../types";

export interface UsePhotosTabDeps {
  alert: (t: string, m: string, b?: any[], type?: any) => void;
  loadData: () => Promise<void>;
  setDayModal: (updater: (prev: any) => any) => void;
  selectedLogDate: Date | null;
  setSelectedLogDate: (d: Date | null) => void;
  authToken?: string | null;
  activeTab: string;
}

export function usePhotosTab(deps: UsePhotosTabDeps) {
  const { alert, loadData, setDayModal, selectedLogDate, setSelectedLogDate, authToken, activeTab } = deps;

  const [progressPhotos, setProgressPhotos] = useState<ProgressPhoto[]>([]);
  const [photoUriCache, setPhotoUriCache] = useState<Record<string, string>>({});
  const [photoUriLoading, setPhotoUriLoading] = useState<Record<string, boolean>>({});
  const [selectedDatePhotos, setSelectedDatePhotos] = useState<any>(null);
  const [showDatePhotosModal, setShowDatePhotosModal] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<ExpandedPhoto | null>(null);

  useEffect(() => {
    if (activeTab === "photos") loadData();
  }, [activeTab, loadData]);

  const handleDeletePhoto = createDeleteHandler<ProgressPhoto>(
    bodyTrackingApi.deleteProgressPhoto,
    setProgressPhotos,
    setDayModal,
    alert,
    (photo) => {
      setPhotoUriCache((prev) => {
        const next = { ...prev };
        delete next[photo.id];
        return next;
      });
      setSelectedDatePhotos((prev: any) => {
        if (!prev) return null;
        const remaining = prev.photos.filter((p: ProgressPhoto) => p.id !== photo.id);
        return remaining.length > 0 ? { ...prev, photos: remaining } : null;
      });
    },
  );

  const deletePhoto = useCallback(
    (photo: ProgressPhoto) => {
      alert(
        "Delete Photo",
        "Permanently delete this progress photo?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => handleDeletePhoto(photo) },
        ],
        "warning",
      );
    },
    [alert, handleDeletePhoto],
  );

  const fetchPhotoUri = useCallback(
    async (photoId: string | number) => {
      if (photoUriCache[photoId] || photoUriLoading[photoId]) return;
      setPhotoUriLoading((prev) => ({ ...prev, [photoId]: true }));
      try {
        const remoteUri = bodyTrackingApi.getPhotoUrl(photoId);
        if (remoteUri.startsWith("file://")) {
          setPhotoUriCache((prev) => ({ ...prev, [photoId]: remoteUri }));
          return;
        }
        const localUri = `${FileSystem.cacheDirectory}photo_${photoId}.jpg`;
        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) {
          setPhotoUriCache((prev) => ({ ...prev, [photoId]: localUri }));
          return;
        }
        const result = await FileSystem.downloadAsync(
          remoteUri,
          localUri,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        if (result.status === 200) {
          setPhotoUriCache((prev) => ({ ...prev, [photoId]: result.uri }));
        } else {
          throw new Error(`Server returned ${result.status}`);
        }
      } catch (error) {
        setPhotoUriCache((prev) => ({ ...prev, [photoId]: "error" }));
      } finally {
        setPhotoUriLoading((prev) => ({ ...prev, [photoId]: false }));
      }
    },
    [photoUriCache, photoUriLoading, authToken],
  );

  const prefetchPhotosForDate = useCallback(
    async (photos: ProgressPhoto[]) => {
      await Promise.all(photos.map((p) => fetchPhotoUri(p.id)));
    },
    [fetchPhotoUri],
  );

  const getPhotosForDate = useCallback(
    (date: Date) => {
      const dateStr = toDateString(date);
      return progressPhotos.filter((p) => isoToLocalDateStr(p?.takenAt) === dateStr);
    },
    [progressPhotos],
  );

  const uploadPhoto = useCallback(
    async (uri: string, dateStr: string | null = null) => {
      try {
        await bodyTrackingApi.uploadProgressPhoto(uri, "image/jpeg", null, dateStr);
        setSelectedLogDate(null);
        alert("Success", "Progress photo saved!", [{ text: "OK" }], "success");
        loadData();
      } catch (error) {
        alert("Error", "Failed to upload photo", [{ text: "OK" }], "error");
      }
    },
    [setSelectedLogDate, alert, loadData],
  );

  const takePhoto = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        alert("Permission Required", "Camera access is needed", [{ text: "OK" }], "warning");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (!result.canceled && result.assets?.[0]) {
        const dateStr = selectedLogDate ? toDateString(selectedLogDate) : null;
        await uploadPhoto(result.assets[0].uri, dateStr);
      }
    } catch (error) {
      alert("Error", "Failed to take photo.", [{ text: "OK" }], "error");
    }
  }, [alert, selectedLogDate, uploadPhoto]);

  const pickPhotoFromGallery = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert("Permission Required", "Photo library access is needed", [{ text: "OK" }], "warning");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (!result.canceled && result.assets?.[0]) {
        const dateStr = selectedLogDate ? toDateString(selectedLogDate) : null;
        await uploadPhoto(result.assets[0].uri, dateStr);
      }
    } catch (error) {
      alert("Error", "Failed to select photo.", [{ text: "OK" }], "error");
    }
  }, [alert, selectedLogDate, uploadPhoto]);

  const pickPhotoForDate = useCallback(
    async (date: Date) => {
      try {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          alert("Permission Required", "Photo library access is needed", [{ text: "OK" }], "warning");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          quality: 0.8,
          allowsEditing: true,
          aspect: [3, 4],
        });
        if (!result.canceled && result.assets?.[0]) {
          await bodyTrackingApi.uploadProgressPhoto(
            result.assets[0].uri,
            "image/jpeg",
            null,
            toDateString(date),
          );
          alert("Photo added", `Photo saved for ${date.toLocaleDateString()}`, [{ text: "OK" }], "success");
          loadData();
        }
      } catch (error) {
        alert("Error", "Failed to add photo.", [{ text: "OK" }], "error");
      }
    },
    [alert, loadData],
  );

  return {
    progressPhotos, setProgressPhotos,
    photoUriCache, setPhotoUriCache,
    photoUriLoading, setPhotoUriLoading,
    selectedDatePhotos, setSelectedDatePhotos,
    showDatePhotosModal, setShowDatePhotosModal,
    expandedPhoto, setExpandedPhoto,
    handleDeletePhoto,
    deletePhoto,
    fetchPhotoUri,
    prefetchPhotosForDate,
    getPhotosForDate,
    uploadPhoto,
    takePhoto,
    pickPhotoFromGallery,
    pickPhotoForDate,
  };
}
