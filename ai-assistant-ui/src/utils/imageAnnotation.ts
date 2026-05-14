export interface Point {
  x: number;
  y: number;
}

export interface AnnotationBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ImageAnnotationType = 'rect' | 'arrow' | 'text';

export interface ImageAnnotation {
  id: string;
  type: ImageAnnotationType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  text?: string;
}

export function normalizeAnnotationBox(start: Point, end: Point): AnnotationBox {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function scaleAnnotation(annotation: ImageAnnotation, scale: number): ImageAnnotation {
  return {
    ...annotation,
    x1: annotation.x1 * scale,
    y1: annotation.y1 * scale,
    x2: annotation.x2 * scale,
    y2: annotation.y2 * scale,
  };
}

export function drawImageAnnotation(ctx: CanvasRenderingContext2D, annotation: ImageAnnotation) {
  ctx.save();
  ctx.strokeStyle = annotation.color;
  ctx.fillStyle = annotation.color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (annotation.type === 'rect') {
    const box = normalizeAnnotationBox(
      { x: annotation.x1, y: annotation.y1 },
      { x: annotation.x2, y: annotation.y2 },
    );
    ctx.strokeRect(box.x, box.y, box.width, box.height);
  } else if (annotation.type === 'arrow') {
    drawArrow(ctx, annotation.x1, annotation.y1, annotation.x2, annotation.y2);
  } else if (annotation.type === 'text' && annotation.text?.trim()) {
    ctx.font = '24px sans-serif';
    ctx.fillText(annotation.text.trim(), annotation.x1, annotation.y1);
  }
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const headLength = 16;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

export async function renderAnnotatedImage(
  imageSrc: string,
  annotations: ImageAnnotation[],
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width || 1;
  canvas.height = img.naturalHeight || img.height || 1;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  annotations.forEach((annotation) => drawImageAnnotation(ctx, annotation));
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load annotation image'));
    img.src = src;
  });
}
