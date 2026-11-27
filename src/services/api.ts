import axios, { AxiosError, type AxiosResponse } from 'axios';
import { config } from '@/lib/config';
import { useAuthStore } from '@/store/useAuthStore';
import type {
  ApiErrorBody,
  ApiSuccess,
  AuthResponse,
  CreateOrderRequest,
  FleetSnapshot,
  LatLng,
  LoginRequest,
  NearbyRider,
  Order,
  OrderStatus,
  PlaceSuggestion,
  RegisterRequest,
  User,
} from './types';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const http = axios.create({
  baseURL: `${config.apiUrl}/api`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Bearer token on every request — same mechanism a mobile client uses.
http.interceptors.request.use((req) => {
  const token = useAuthStore.getState().token;
  if (token) req.headers.set('Authorization', `Bearer ${token}`);
  return req;
});

http.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiErrorBody>) => {
    const status = err.response?.status ?? 0;
    const body = err.response?.data?.error;
    if (status === 401 && useAuthStore.getState().token && body?.code !== 'INVALID_CREDENTIALS') {
      useAuthStore.getState().logout(); // expired / revoked token
    }
    if (!err.response) {
      return Promise.reject(new ApiClientError('Cannot reach the server. Is the backend running?', 0, 'NETWORK_ERROR'));
    }
    return Promise.reject(
      new ApiClientError(body?.message ?? err.message, status, body?.code ?? 'UNKNOWN', body?.details),
    );
  },
);

async function unwrap<T>(request: Promise<AxiosResponse<ApiSuccess<T>>>): Promise<T> {
  const res = await request;
  return res.data.data;
}

export const authApi = {
  login: (body: LoginRequest) => unwrap<AuthResponse>(http.post('/auth/login', body)),
  register: (body: RegisterRequest) => unwrap<AuthResponse>(http.post('/auth/register', body)),
  me: () => unwrap<User>(http.get('/auth/me')),
};

export const ordersApi = {
  list: (params?: { status?: OrderStatus[]; limit?: number }) =>
    unwrap<Order[]>(
      http.get('/orders', { params: { limit: params?.limit, status: params?.status?.join(',') || undefined } }),
    ),
  get: (id: string) => unwrap<Order>(http.get(`/orders/${id}`)),
  create: (body: CreateOrderRequest) => unwrap<Order>(http.post('/orders', body)),
  assign: (id: string, riderId: string) => unwrap<Order>(http.post(`/orders/${id}/assign`, { riderId })),
  updateStatus: (id: string, status: OrderStatus, note?: string) =>
    unwrap<Order>(http.patch(`/orders/${id}/status`, { status, note })),
  nearbyRiders: (id: string, maxDistanceMeters = 10_000) =>
    unwrap<NearbyRider[]>(http.get(`/orders/${id}/nearby-riders`, { params: { maxDistanceMeters } })),
  fleet: () => unwrap<FleetSnapshot>(http.get('/orders/fleet')),
};

export const geocodeApi = {
  search: (q: string, near?: LatLng | null, signal?: AbortSignal) =>
    unwrap<PlaceSuggestion[]>(
      http.get('/geocode/search', { params: { q, lat: near?.lat, lng: near?.lng }, signal }),
    ),
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
      return (err.details as Array<{ path: string; message: string }>).map((d) => `${d.path}: ${d.message}`).join(', ');
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
