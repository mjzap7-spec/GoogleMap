/** These are public client settings. Never put a Cloudinary API secret here. */
export function getCloudinaryConfig() {
  return {
    cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() ?? '',
    uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() ?? '',
  };
}
