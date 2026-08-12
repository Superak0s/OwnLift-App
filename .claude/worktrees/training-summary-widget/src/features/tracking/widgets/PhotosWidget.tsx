import React from "react";
import { Text } from "react-native";
import {
  PhotosCalendarWidget,
  PhotosGalleryWidget,
  PhotosComparisonWidget,
} from "../tabs/PhotosTab";

export interface PhotosRenderCtx {
  styles: any;
}

export function renderPhotosWidget(type: string, ctx: PhotosRenderCtx): React.ReactNode {
  const { styles } = ctx;

  switch (type) {
    case "photos_calendar": return <PhotosCalendarWidget />;
    case "photos_gallery": return <PhotosGalleryWidget />;
    case "photos_comparison": return <PhotosComparisonWidget />;
    default: return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  }
}
