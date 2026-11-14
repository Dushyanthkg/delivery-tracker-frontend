import type { LatLng } from '@/services/types';

/** Leaflet-free types so views can import them without pulling Leaflet into SSR. */
export type PlaceKind = 'pickup' | 'dropoff' | 'order' | 'draft';

export interface MapPlace {
  id: string;
  position: LatLng;
  kind: PlaceKind;
  label?: string;
  selected?: boolean;
  onClick?: () => void;
}

export interface LiveTrackingMapProps {
  className?: string;
  /** Initial centre when there is nothing to fit to. */
  center?: LatLng;
  zoom?: number;
  route?: LatLng[] | null;
  places?: MapPlace[];
  /** Riders to render; positions come from the tracking store, not props. */
  riderIds?: string[];
  /** Rider the camera follows (user can toggle / drag to break follow). */
  followRiderId?: string | null;
  /** Change this value to re-fit the viewport to route + places. */
  fitKey?: string | number | null;
  onMapClick?: (p: LatLng) => void;
  onRiderClick?: (riderId: string) => void;
}

/** Camera shared between the 2D and 3D views, in Leaflet zoom units. */
export interface MapView {
  center: LatLng;
  zoom: number;
}
