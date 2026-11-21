import { describe, expect, it } from 'vitest';
import {
  bearing,
  buildPathIndex,
  densifyLine,
  haversine,
  lerpAngle,
  nearestVertexIndex,
  offsetPoint,
  pointAlong,
  projectOntoPath,
} from './geo';

const A = { lat: 12.9716, lng: 77.5946 };
const B = { lat: 12.9352, lng: 77.6245 };

describe('geo helpers', () => {
  it('haversine matches known distances', () => {
    expect(haversine(A, A)).toBe(0);
    expect(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
    expect(haversine(A, B)).toBeCloseTo(haversine(B, A), 6);
  });

  it('lerpAngle turns the short way round', () => {
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(0, 6);
    expect(lerpAngle(10, 350, 0.5)).toBeCloseTo(0, 6);
    expect(lerpAngle(0, 90, 0.5)).toBeCloseTo(45, 6);
    expect(lerpAngle(90, 270, 1)).toBeCloseTo(270, 6);
  });

  it('offsetPoint moves the given distance along the bearing', () => {
    for (const deg of [0, 45, 90, 200, 315]) {
      const p = offsetPoint(A, 250, deg);
      expect(haversine(A, p)).toBeCloseTo(250, 3);
      expect(bearing(A, p)).toBeCloseTo(deg, 1);
    }
  });

  it('densifyLine spaces points evenly and keeps both ends', () => {
    const line = densifyLine(A, B, 25);
    expect(line[0]).toEqual(A);
    expect(line.at(-1)!.lat).toBeCloseTo(B.lat, 10);
    for (let i = 1; i < line.length; i++) expect(haversine(line[i - 1]!, line[i]!)).toBeLessThanOrEqual(25.01);
    expect(densifyLine(A, A)).toHaveLength(2);
  });

  it('nearestVertexIndex finds the closest vertex', () => {
    const line = densifyLine(A, B, 100);
    expect(nearestVertexIndex(line, line[7]!)).toBe(7);
    expect(nearestVertexIndex(line, offsetPoint(line[12]!, 10, 90))).toBe(12);
  });

  describe('path index', () => {
    const path = buildPathIndex(densifyLine(A, B, 50));

    it('pointAlong walks the path and clamps to its ends', () => {
      expect(pointAlong(path, -100).position).toEqual(A);
      expect(pointAlong(path, path.total + 100).position.lat).toBeCloseTo(B.lat, 10);
      const mid = pointAlong(path, path.total / 2);
      expect(haversine(A, mid.position)).toBeCloseTo(path.total / 2, 0);
      expect(mid.heading).toBeCloseTo(bearing(A, B), 0);
    });

    it('projectOntoPath reports distance along and offset', () => {
      const along = 1_000;
      const onPath = pointAlong(path, along).position;
      const beside = offsetPoint(onPath, 30, (bearing(A, B) + 90) % 360);
      const proj = projectOntoPath(path, beside);
      expect(proj.distance).toBeCloseTo(along, -1);
      expect(proj.offset).toBeCloseTo(30, 0);
    });

    it('handles single-point paths', () => {
      const one = buildPathIndex([A]);
      expect(one.total).toBe(0);
      expect(pointAlong(one, 50).position).toEqual(A);
      expect(projectOntoPath(one, B).offset).toBeCloseTo(haversine(A, B), 6);
    });
  });
});
