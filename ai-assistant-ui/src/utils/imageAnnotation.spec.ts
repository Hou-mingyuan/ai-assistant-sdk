import { describe, expect, it } from 'vitest';

import { normalizeAnnotationBox, scaleAnnotation } from './imageAnnotation';

describe('normalizeAnnotationBox', () => {
  it('normalizes drag coordinates into top-left plus size', () => {
    expect(normalizeAnnotationBox({ x: 80, y: 40 }, { x: 20, y: 90 })).toEqual({
      x: 20,
      y: 40,
      width: 60,
      height: 50,
    });
  });
});

describe('scaleAnnotation', () => {
  it('scales all coordinate fields without mutating the source', () => {
    const annotation = {
      id: 'a',
      type: 'arrow' as const,
      x1: 10,
      y1: 20,
      x2: 30,
      y2: 40,
      color: '#f00',
    };

    expect(scaleAnnotation(annotation, 2)).toMatchObject({
      x1: 20,
      y1: 40,
      x2: 60,
      y2: 80,
    });
    expect(annotation.x1).toBe(10);
  });
});
