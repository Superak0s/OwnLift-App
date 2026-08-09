import { Image } from "react-native"
import * as ImageManipulator from "expo-image-manipulator"

// Camera/gallery photos come in at full sensor resolution (often several MB).
// Uploading that raw is what made progress-photo saves "giga slow" over
// mobile networks — this downsizes + recompresses before any upload.
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.6

function getImageWidth(uri: string): Promise<number> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width) => resolve(width),
      () => resolve(0),
    )
  })
}

export async function compressImageForUpload(uri: string): Promise<string> {
  try {
    const width = await getImageWidth(uri)
    const actions =
      width > MAX_DIMENSION ? [{ resize: { width: MAX_DIMENSION } }] : []
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    })
    return result.uri
  } catch (error) {
    console.error("Error compressing image, uploading original:", error)
    return uri
  }
}
