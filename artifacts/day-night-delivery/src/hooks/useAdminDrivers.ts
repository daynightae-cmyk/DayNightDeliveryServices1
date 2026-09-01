import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { resolveDriverAvatarUrls } from "../lib/driverData";
import {
  fetchAdminOrdersResilient,
  waitForAdminOperationalSession,
} from "../lib/adminOrderRecovery";
import type {
  DriverAssignmentHistory,
  DriverEvent,
  DriverLocation,
  DriverOverviewRow,
  DriverPresence,
  DriverProfile,
  DriverTrailPoint,
  DriverOrder,
} from "../types/driver";

export type AdminDriverRow = DriverOverviewRow;

const CLOSED_STATUSES = new Set(["delivered", "cancelled", "returned"]);
const IN_PROGRESS_STATUSES = new Set(["accepted", "picked_up", "in_transit"]);

const statusKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const compactText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[ـ]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "");

const phoneDigits = (value: unknown) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 9) digits = `971${digits.slice(1)}`;
  return digits;
};

export function driverPresence(lastSeen?: string | null, onlineFlag?: boolean | null): DriverPresence {
  if (!lastSeen || onlineFlag === false) return "offline";
  const time = new Date(lastSeen).getTime();
  if (!Number.isFinite(time)) return "problem";
  const age = Date.now() - time;
  if (age < 120_000) return "online";
  if (age < 600_000) return "idle";
  return "offline";
}

function normalizeLocation(row: DriverLocation | null): DriverLocation | null {
  if (!row) return null;
  const lat = Number(row.lat ?? row.latitude);
  const lng = Number(row.lng ?? row.longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    !row.last_seen_at
  ) {
    return null;
  }
  return { ...row, lat, lng };
}

function normalizeTrailPoint(point: DriverTrailPoint): DriverTrailPoint | null {
  const lat = Number(point.lat ?? point.latitude);
  const lng = Number(point.lng ?? point.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { ...point, lat, lng };
}

function optionalDispatchTableError(message?: string | null) {
  return Boolean(message && /driver_assignment_history|schema cache|does not exist/i.test(message));
}

/**
 * The production database contains orders created by several generations of the
 * admin/driver apps. New rows have driver_id/assigned_driver_id, while older rows
 * may only keep driver_name/driver_phone/driver_code. Assignment history is the
 * canonical fallback when the order row itself was not backfilled.
 */
function latestAssignmentByOrder(assignments: DriverAssignmentHistory[]) {
  const map = new Map<string, string | null>();
  for (const entry of assignments) {
    const orderId = String(entry.order_id || "").trim();
    if (!orderId || map.has(orderId)) continue;
    const action = statusKey(entry.action);
    map.set(orderId, action === "unassigned" ? null : String(entry.driver_id || "").trim() || null);
  }
  return map;
}

type DriverMatchIdentity = {
  ids: Set<string>;
  phone: string;
  names: Set<string>;
};

function buildDriverMatchIdentity(driver: DriverProfile): DriverMatchIdentity {
  return {
    ids: new Set(
      [driver.id, driver.user_id]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
    phone: phoneDigits(driver.phone),
    names: new Set(
      [compactText(driver.full_name), compactText(driver.name)].filter(Boolean),
    ),
  };
}

function orderBelongsToDriver(
  order: DriverOrder,
  driver: DriverMatchIdentity,
  assignmentMap: Map<string, string | null>,
) {
  const orderId = String(order.id || "").trim();
  const hasCanonicalAssignment = Boolean(orderId && assignmentMap.has(orderId));
  const canonicalAssignment = hasCanonicalAssignment ? assignmentMap.get(orderId) : undefined;
  const orderIds = [order.driver_id, order.assigned_driver_id, canonicalAssignment, order.driver_code]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (orderIds.some((value) => driver.ids.has(value))) return true;

  // Explicit assignment history is authoritative. If its latest entry says the
  // order is unassigned or assigned elsewhere, stale legacy name/phone fields
  // must not attach the order to an old driver statement.
  if (hasCanonicalAssignment) return false;

  const orderPhone = phoneDigits(order.driver_phone);
  if (driver.phone && orderPhone && driver.phone === orderPhone) return true;

  const orderName = compactText(order.driver_name);
  return Boolean(orderName && driver.names.has(orderName));
}

export function useAdminDrivers() {
  const [drivers, setDrivers] = useState<AdminDriverRow[]>([]);
  const [dispatchOrders, setDispatchOrders] = useState<DriverOrder[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<DriverAssignmentHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const refreshTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    setLoading(true);
    setError("");

    try {
      // The protected Admin shell can render before Supabase restores its access
      // token. Starting the direct orders query during that hydration window can
      // legitimately return an empty RLS result and leave Driver Statements at 0
      // until a later database mutation. Wait for the verified Admin session first
      // and reuse the same resilient complete-orders reader as the orders workspace.
      await waitForAdminOperationalSession();

      const [
        profilesResult,
        locationsResult,
        trailResult,
        eventsResult,
        assignmentsResult,
        recoveredOrders,
      ] = await Promise.all([
        client.from("driver_profiles").select("*").order("created_at", { ascending: false }),
        client.from("driver_locations").select("*").order("last_seen_at", { ascending: false }),
        client.from("driver_location_history").select("*").order("recorded_at", { ascending: false }).limit(3000),
        client.from("driver_events").select("*").order("created_at", { ascending: false }).limit(1500),
        client.from("driver_assignment_history").select("*").order("created_at", { ascending: false }).limit(5000),
        fetchAdminOrdersResilient(),
      ]);

      const coreError =
        profilesResult.error || locationsResult.error || trailResult.error || eventsResult.error;
      if (coreError) setError(coreError.message);
      else if (assignmentsResult.error && !optionalDispatchTableError(assignmentsResult.error.message)) {
        setError(assignmentsResult.error.message);
      }

      const orderRows = (recoveredOrders || []) as DriverOrder[];
      const rawProfiles = (profilesResult.data || []) as DriverProfile[];
      const profiles = await resolveDriverAvatarUrls(rawProfiles);
      const locations = (locationsResult.data || []) as DriverLocation[];
      const trails = (trailResult.data || []) as DriverTrailPoint[];
      const events = (eventsResult.data || []) as DriverEvent[];
      const assignments = (assignmentsResult.data || []) as DriverAssignmentHistory[];
      const assignmentMap = latestAssignmentByOrder(assignments);
      const today = new Date().toDateString();

      setDispatchOrders(orderRows.filter((order) => !CLOSED_STATUSES.has(statusKey(order.status))));
      setAssignmentHistory(assignments);

      setDrivers(
        profiles.map((driver) => {
          const rawLocation = locations.find((row) => row.driver_id === driver.id) || null;
          const location = normalizeLocation(rawLocation);
          const identity = buildDriverMatchIdentity(driver);
          const orders = orderRows.filter((order) => orderBelongsToDriver(order, identity, assignmentMap));
          const activeOrders = orders.filter((order) => !CLOSED_STATUSES.has(statusKey(order.status)));
          const deliveredToday = orders.filter(
            (order) =>
              statusKey(order.status) === "delivered" &&
              new Date(order.updated_at || order.created_at).toDateString() === today,
          ).length;
          const driverTrail = trails
            .filter((point) => point.driver_id === driver.id)
            .map(normalizeTrailPoint)
            .filter((point): point is DriverTrailPoint => Boolean(point))
            .slice(0, 180)
            .reverse();

          return {
            ...driver,
            location,
            orders,
            trail: driverTrail,
            events: events.filter((event) => event.driver_id === driver.id).slice(0, 40),
            presence: driverPresence(location?.last_seen_at, location?.is_online),
            active_orders: activeOrders.length,
            delivered_today: deliveredToday,
            cod_active: activeOrders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0),
          };
        }),
      );
      setLastUpdatedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => void refresh(), 350);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("admin-driver-operations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_profiles" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_location_history" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_events" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_assignment_history" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      void client.removeChannel(channel);
    };
  }, [scheduleRefresh]);

  const stats = useMemo(() => {
    const unassigned = dispatchOrders.filter(
      (order) => !order.assigned_driver_id && !order.driver_id,
    ).length;
    const assigned = dispatchOrders.length - unassigned;
    const inProgress = dispatchOrders.filter((order) => IN_PROGRESS_STATUSES.has(statusKey(order.status))).length;

    return {
      total: drivers.length,
      online: drivers.filter((driver) => driver.presence === "online").length,
      idle: drivers.filter((driver) => driver.presence === "idle").length,
      offline: drivers.filter((driver) => driver.presence === "offline").length,
      activeOrders: drivers.reduce((sum, driver) => sum + driver.active_orders, 0),
      codActive: drivers.reduce((sum, driver) => sum + driver.cod_active, 0),
      deliveredToday: drivers.reduce((sum, driver) => sum + driver.delivered_today, 0),
      unassigned,
      assigned,
      inProgress,
      dispatchable: dispatchOrders.length,
      attention: drivers.filter((driver) => {
        const noGps = !driver.location;
        const noPhone = !driver.phone;
        const noAvatar = !driver.avatar_path;
        const licenseExpired = driver.license_expiry ? new Date(driver.license_expiry).getTime() < Date.now() : false;
        const registrationExpired = driver.vehicle_registration_expiry
          ? new Date(driver.vehicle_registration_expiry).getTime() < Date.now()
          : false;
        return noGps || noPhone || noAvatar || licenseExpired || registrationExpired || driver.presence === "problem";
      }).length,
    };
  }, [dispatchOrders, drivers]);

  return {
    drivers,
    dispatchOrders,
    assignmentHistory,
    stats,
    loading,
    error,
    lastUpdatedAt,
    refresh,
  };
}
