import type { Order } from "../types";

export type DriverPresence = "online" | "idle" | "offline" | "problem";
export type DriverShiftStatus = "offline" | "available" | "busy" | "paused";
export type DriverAccountStatus = "active" | "inactive" | "suspended";
export type DriverDispatchAction = "assign" | "reassign" | "unassign";

export type ProfileRole = {
  id: string;
  role?: string | null;
  full_name?: string | null;
  phone?: string | null;
  is_active?: boolean | null;
};

export type DriverProfile = {
  id: string;
  user_id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: DriverAccountStatus | string | null;
  shift_status?: DriverShiftStatus | string | null;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
  vehicle_color?: string | null;
  emirate?: string | null;
  license_number?: string | null;
  emergency_contact?: string | null;
  last_status_note?: string | null;
  avatar_path?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  work_area?: string | null;
  nationality?: string | null;
  address?: string | null;
  preferred_language?: string | null;
  license_expiry?: string | null;
  vehicle_registration_expiry?: string | null;
  base_salary?: number | null;
  salary_currency?: string | null;
  salary_cycle?: string | null;
  salary_effective_from?: string | null;
  joined_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DriverLocation = {
  id?: string;
  driver_id: string;
  lat: number;
  lng: number;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
  is_online?: boolean | null;
  battery_level?: number | null;
  network_state?: string | null;
  last_seen_at?: string | null;
  current_order_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DriverTrailPoint = {
  id?: string;
  driver_id: string;
  order_id?: string | null;
  lat: number;
  lng: number;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
  recorded_at?: string | null;
};

export type DriverEvent = {
  id: string;
  driver_id: string;
  event_type: string;
  order_id?: string | null;
  payload?: Record<string, unknown> | null;
  actor_id?: string | null;
  created_at: string;
};

export type DriverAssignmentHistory = {
  id: string;
  order_id: string;
  action: "assigned" | "reassigned" | "unassigned" | string;
  previous_driver_id?: string | null;
  driver_id?: string | null;
  previous_status?: string | null;
  resulting_status?: string | null;
  note?: string | null;
  forced?: boolean | null;
  actor_id?: string | null;
  created_at: string;
};

export type DriverDispatchResult = {
  ok: boolean;
  action: string;
  order_id: string;
  driver_id?: string | null;
  previous_driver_id?: string | null;
  status?: string | null;
  assignment_version?: number | null;
  already_assigned?: boolean;
  already_unassigned?: boolean;
};

export type DriverSessionPayload = {
  profile: ProfileRole;
  driver: DriverProfile;
};

export type DriverOrder = Order & {
  driver_id?: string | null;
  assigned_driver_id?: string | null;
  priority?: string | null;
  pickup_date_time?: string | null;
  delivery_date_time?: string | null;
  driver_assigned_at?: string | null;
  driver_assigned_by?: string | null;
  driver_assignment_note?: string | null;
  driver_assignment_version?: number | null;
};

export type DriverOverviewRow = DriverProfile & {
  location?: DriverLocation | null;
  orders: DriverOrder[];
  trail: DriverTrailPoint[];
  events: DriverEvent[];
  presence: DriverPresence;
  active_orders: number;
  delivered_today: number;
  cod_active: number;
};

export type DriverStatusAction = {
  value: "confirmed" | "picked_up" | "in_transit" | "delivered" | "cancelled" | "returned";
  ar: string;
  en: string;
  requiresNote?: boolean;
};
