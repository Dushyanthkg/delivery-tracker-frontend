'use client';

import { Marker, Tooltip } from 'react-leaflet';
import type { MapPlace } from './map.types';
import { placeIcon } from './icons';

export function PlaceMarker({ place }: { place: MapPlace }) {
  return (
    <Marker
      position={[place.position.lat, place.position.lng]}
      icon={placeIcon(place.kind, place.selected)}
      zIndexOffset={place.selected ? 500 : 0}
      eventHandlers={place.onClick ? { click: place.onClick } : undefined}
    >
      {place.label && <Tooltip direction="top">{place.label}</Tooltip>}
    </Marker>
  );
}
