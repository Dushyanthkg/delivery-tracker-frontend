'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { riderIcon } from './icons';
import { riderColor } from './theme';
import { startRiderGlide } from './riderGlide';

interface Props {
  riderId: string;
  follow?: boolean;
  onClick?: (riderId: string) => void;
}

/**
 * 2D (Leaflet) rider marker that glides between GPS fixes.
 * Renders `null`; animation is driven outside React by `startRiderGlide`.
 */
export function SmoothRiderMarker({ riderId, follow = false, onClick }: Props) {
  const map = useMap();
  const followRef = useRef(follow);
  const onClickRef = useRef(onClick);
  useEffect(() => {
    followRef.current = follow;
    onClickRef.current = onClick;
  });

  useEffect(() => {
    const marker = L.marker([0, 0], { icon: riderIcon(riderColor(riderId)), zIndexOffset: 1_000, keyboard: false });
    marker.on('click', () => onClickRef.current?.(riderId));

    return startRiderGlide(
      riderId,
      {
        show: (pos) => marker.setLatLng(pos).addTo(map),
        hide: () => marker.remove(),
        setPosition: (pos) => marker.setLatLng(pos),
        setHeading: (deg) => {
          const arrow = marker.getElement()?.querySelector<HTMLElement>('.rider-marker__arrow');
          if (arrow) arrow.style.transform = `rotate(${deg}deg)`;
        },
        setMeta: (rider) => {
          if (marker.getTooltip()) marker.setTooltipContent(rider.name);
          else marker.bindTooltip(rider.name, { direction: 'top', className: 'rider-tooltip' });
          marker.getElement()?.classList.toggle('is-offline', !rider.isOnline);
        },
        pan: (target, durationMs) =>
          durationMs == null
            ? map.panTo(target, { animate: false })
            : map.panTo(target, { animate: true, duration: durationMs / 1000, easeLinearity: 1, noMoveStart: true }),
      },
      () => followRef.current,
    );
  }, [map, riderId]);

  return null;
}
