export function matchesScreenCaptureShortcut(e: KeyboardEvent): boolean {
  const ctrl = Boolean(e.ctrlKey || e.metaKey);
  return ctrl && Boolean(e.shiftKey) && !e.altKey && e.key.toLowerCase() === 'i';
}

export function isScreenCaptureSupported(mediaDevices?: MediaDevices): boolean {
  const devices =
    mediaDevices ??
    (typeof navigator !== 'undefined'
      ? navigator.mediaDevices
      : (undefined as MediaDevices | undefined));
  return typeof devices?.getDisplayMedia === 'function';
}

export async function captureScreenDataUrl(): Promise<string> {
  if (!isScreenCaptureSupported()) {
    throw new Error('screen-capture-unsupported');
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    if (!video.videoWidth || !video.videoHeight) {
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1;
    canvas.height = video.videoHeight || 1;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
