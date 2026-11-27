/**
 * API + Socket.io contract (frontend copy).
 * Must stay identical to `backend/src/shared/types.ts` — the projects are
 * deliberately independent, so update both when the contract changes. A future React Native / Flutter app
 * should mirror these shapes exactly.
 *
 * Conventions:
 *  - Coordinates on the wire are always `{ lat, lng }` objects (never arrays),
 *    so clients never have to guess the axis order. GeoJSON `[lng, lat]` is a
 *    storage detail that stays inside the backend.
 *  - All timestamps are ISO-8601 strings (UTC).
 *  - All IDs are strings (Mongo ObjectId hex).
 *  - Auth is Bearer-token only (HTTP `Authorization` header, Socket.io
 *    `handshake.auth.token`). No cookies anywhere.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoPosition extends LatLng {
  /** Degrees clockwise from true north, 0–360. */
  heading?: number | null;
  /** Metres per second. */
  speed?: number | null;
  /** Horizontal accuracy in metres. */
  accuracy?: number | null;
  /** ISO timestamp of when the device captured the fix. */
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const USER_ROLES = ['customer', 'rider', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles allowed through public self-registration. Admins are seeded. */
export const SELF_REGISTER_ROLES = ['customer', 'rider'] as const;
export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  /** Riders only: whether they are currently on shift and broadcasting. */
  isOnline: boolean;
  /** Riders only: last persisted location. */
  currentLocation?: LatLng | null;
  lastLocationAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  'pending', // created by customer, waiting for dispatch
  'assigned', // rider assigned, heading to pickup
  'picked_up', // rider has the package
  'in_transit', // rider started delivery, heading to dropoff
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses during which the rider is expected to stream GPS. */
export const ACTIVE_ORDER_STATUSES = ['assigned', 'picked_up', 'in_transit'] as const satisfies readonly OrderStatus[];
export type ActiveOrderStatus = (typeof ACTIVE_ORDER_STATUSES)[number];

/** Allowed state-machine transitions (enforced by the backend). */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'pending', 'cancelled'], // -> pending = unassign
  picked_up: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export interface OrderLocation extends LatLng {
  address: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
  /** User id that caused the change (null = system). */
  by: string | null;
  note?: string | null;
}

export interface RouteInfo {
  /** Ordered road geometry from the leg's start to its end. */
  polyline: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  /** 'ors' / 'osrm' = real road route; 'fallback' = straight line (no routing engine reachable). */
  source: 'ors' | 'osrm' | 'fallback';
}

export interface EtaInfo {
  /** Remaining distance to the current target (pickup or dropoff). */
  distanceMeters: number;
  durationSeconds: number;
  target: 'pickup' | 'dropoff';
  /** ISO timestamp of predicted arrival. */
  arrivalAt: string;
}

/** Lightweight user reference embedded in orders. */
export interface UserSummary {
  id: string;
  name: string;
  phone?: string | null;
}

export interface Order {
  id: string;
  /** Short human-friendly code, e.g. "DT-7K3QX9". */
  code: string;
  customer: UserSummary;
  rider: UserSummary | null;
  status: OrderStatus;
  pickup: OrderLocation;
  dropoff: OrderLocation;
  /** Road route for the delivery leg (pickup → dropoff; replaced from the rider's position on re-route). */
  route: RouteInfo | null;
  /** Road route for the rider → pickup leg, set once a rider is assigned. */
  pickupRoute: RouteInfo | null;
  /** Last known rider position for this order (for initial map render). */
  lastRiderLocation: GeoPosition | null;
  eta: EtaInfo | null;
  notes?: string | null;
  statusHistory: OrderStatusEvent[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* REST DTOs                                                           */
/* ------------------------------------------------------------------ */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: SelfRegisterRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  /** Seconds until the token expires. */
  expiresIn: number;
  user: User;
}

export interface CreateOrderRequest {
  pickup: OrderLocation;
  dropoff: OrderLocation;
  notes?: string;
}

export interface AssignRiderRequest {
  riderId: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  note?: string;
}

export interface NearbyRider {
  rider: UserSummary;
  location: LatLng;
  distanceMeters: number;
  lastLocationAt: string | null;
}

/** Admin dispatch board snapshot. */
export interface FleetSnapshot {
  riders: Array<{
    rider: UserSummary;
    isOnline: boolean;
    location: LatLng | null;
    lastLocationAt: string | null;
    activeOrderId: string | null;
  }>;
  unassignedOrders: Order[];
  activeOrders: Order[];
  /** Live auto-dispatch state of pending orders (socket snapshot only). */
  dispatch?: DispatchStatusBroadcast[];
}

/** Which leg of a delivery a route belongs to. */
export type RouteLeg = 'pickup' | 'dropoff';

/** Returns the route the rider is currently following (rider → pickup, then pickup → dropoff). */
export function activeLegRoute(order: Pick<Order, 'status' | 'route' | 'pickupRoute'>): RouteInfo | null {
  return order.status === 'assigned' ? (order.pickupRoute ?? null) : order.route;
}

/* ------------------------------------------------------------------ */
/* Socket.io contract                                                  */
/* ------------------------------------------------------------------ */

export const SOCKET_EVENTS = {
  // client -> server
  JOIN_ORDER_ROOM: 'join_order_room',
  LEAVE_ORDER_ROOM: 'leave_order_room',
  JOIN_FLEET_ROOM: 'join_fleet_room',
  RIDER_LOCATION_UPDATE: 'rider_location_update', // also server -> client
  RIDER_SET_ONLINE: 'rider_set_online',
  DISPATCH_OFFER_RESPOND: 'dispatch_offer_respond',
  // server -> client
  ORDER_STATUS_CHANGED: 'order_status_changed',
  ORDER_ASSIGNED: 'order_assigned',
  ORDER_CREATED: 'order_created',
  FLEET_RIDER_LOCATION: 'fleet_rider_location',
  FLEET_RIDER_PRESENCE: 'fleet_rider_presence',
  ORDER_ROUTE_UPDATED: 'order_route_updated',
  DISPATCH_OFFER: 'dispatch_offer',
  DISPATCH_OFFER_CANCELLED: 'dispatch_offer_cancelled',
  DISPATCH_STATUS: 'dispatch_status',
} as const;

/** Uniform acknowledgement for every client->server event that takes a callback. */
export type SocketAck<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: { code: string; message: string } };

export interface JoinOrderRoomPayload {
  orderId: string;
}

export interface JoinOrderRoomResult {
  order: Order;
}

/** Emitted by the rider device every 3–5 s or after moving > 10 m. */
export interface RiderLocationUpdatePayload extends GeoPosition {
  /** The active order the rider is serving (omit when idle but online). */
  orderId?: string | null;
}

/** Broadcast to `order:{id}` room members (customer, admin). */
export interface RiderLocationBroadcast {
  orderId: string;
  riderId: string;
  /** Display position: snapped onto the active route when the fix is close to it. */
  position: GeoPosition;
  /** True when `position` was snapped onto the route (raw GPS was within a few metres of it). */
  snapped?: boolean;
  eta: EtaInfo | null;
}

/** Broadcast to the admin `fleet` room. */
export interface FleetRiderLocationBroadcast {
  riderId: string;
  riderName: string;
  position: GeoPosition;
  activeOrderId: string | null;
}

export interface FleetRiderPresenceBroadcast {
  riderId: string;
  riderName: string;
  isOnline: boolean;
}

export interface OrderStatusChangedBroadcast {
  orderId: string;
  status: OrderStatus;
  event: OrderStatusEvent;
  order: Order;
}

export interface OrderAssignedBroadcast {
  order: Order;
}

export interface OrderCreatedBroadcast {
  order: Order;
}

/** A leg's road route was fetched or recomputed (assignment, off-route re-route, fallback upgrade). */
export interface OrderRouteUpdatedBroadcast {
  orderId: string;
  leg: RouteLeg;
  route: RouteInfo;
  reason: 'assigned' | 'off_route' | 'upgrade';
}

/** Auto-dispatch: a job offer sent to one nearby rider, who must accept before it expires. */
export interface DispatchOffer {
  offerId: string;
  order: Order;
  /** Road travel estimate from the rider to the pickup. */
  pickupDistanceMeters: number;
  pickupDurationSeconds: number;
  /** ISO timestamp; the offer moves to the next rider after this. */
  expiresAt: string;
  /** Total time the rider had to respond (for the countdown bar). */
  timeoutSeconds: number;
}

export interface DispatchOfferCancelled {
  offerId: string;
  orderId: string;
  reason: 'expired' | 'taken' | 'cancelled';
}

export interface DispatchOfferRespondPayload {
  offerId: string;
  accept: boolean;
}

/** Admin `fleet` room: where each pending order is in the auto-dispatch loop. */
export interface DispatchStatusBroadcast {
  orderId: string;
  state: 'searching' | 'offered' | 'no_riders' | 'done';
  riderId?: string | null;
  riderName?: string | null;
  expiresAt?: string | null;
  /** Riders who declined or let an offer expire for this order. */
  attempts: number;
}

export interface ClientToServerEvents {
  join_order_room: (payload: JoinOrderRoomPayload, ack: (res: SocketAck<JoinOrderRoomResult>) => void) => void;
  leave_order_room: (payload: JoinOrderRoomPayload, ack?: (res: SocketAck) => void) => void;
  join_fleet_room: (ack: (res: SocketAck<FleetSnapshot>) => void) => void;
  rider_set_online: (payload: { isOnline: boolean }, ack?: (res: SocketAck) => void) => void;
  rider_location_update: (payload: RiderLocationUpdatePayload, ack?: (res: SocketAck<{ eta: EtaInfo | null }>) => void) => void;
  dispatch_offer_respond: (
    payload: DispatchOfferRespondPayload,
    ack: (res: SocketAck<{ order: Order | null }>) => void,
  ) => void;
}

export interface ServerToClientEvents {
  rider_location_update: (payload: RiderLocationBroadcast) => void;
  order_status_changed: (payload: OrderStatusChangedBroadcast) => void;
  order_assigned: (payload: OrderAssignedBroadcast) => void;
  order_created: (payload: OrderCreatedBroadcast) => void;
  fleet_rider_location: (payload: FleetRiderLocationBroadcast) => void;
  fleet_rider_presence: (payload: FleetRiderPresenceBroadcast) => void;
  order_route_updated: (payload: OrderRouteUpdatedBroadcast) => void;
  dispatch_offer: (payload: DispatchOffer) => void;
  dispatch_offer_cancelled: (payload: DispatchOfferCancelled) => void;
  dispatch_status: (payload: DispatchStatusBroadcast) => void;
}

/** Address suggestion from GET /geocode/search. */
export interface PlaceSuggestion {
  id: string;
  /** Primary line, e.g. "MG Road Metro Station". */
  name: string;
  /** Secondary line, e.g. "Mahatma Gandhi Road, Bengaluru". */
  detail: string;
  /** Full single-line address to store on the order. */
  address: string;
  lat: number;
  lng: number;
}
