import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { DriverLocation, DriverProfile, DriverTrailPoint } from "../types/driver";
import type { Order } from "../types";

export type AdminDriverRow = DriverProfile & { location?: DriverLocation | null; orders: Order[]; trail: DriverTrailPoint[] };
export function driverPresence(lastSeen?: string | null): "online" | "idle" | "offline" { if (!lastSeen) return "offline"; const age = Date.now() - new Date(lastSeen).getTime(); if (age < 120000) return "online"; if (age < 600000) return "idle"; return "offline"; }
export function useAdminDrivers() {
 const [drivers,setDrivers]=useState<AdminDriverRow[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
 const refresh=useCallback(async()=>{ const client = supabase; if(!client) return; setLoading(true); setError(""); const [{data:dp,error:e1},{data:loc,error:e2},{data:orders,error:e3},{data:trail,error:e4}] = await Promise.all([client.from("driver_profiles").select("*").order("created_at",{ascending:false}), client.from("driver_locations").select("*").order("last_seen_at",{ascending:false}), client.from("orders").select("*").not("assigned_driver_id","is",null).limit(500), client.from("driver_location_history").select("*").order("recorded_at",{ascending:false}).limit(1000)]); const firstError=e1||e2||e3||e4; if(firstError) setError(firstError.message); const locations=(loc||[]) as DriverLocation[]; const orderRows=(orders||[]) as Order[]; const trails=(trail||[]) as DriverTrailPoint[]; setDrivers(((dp||[]) as DriverProfile[]).map((d)=>({ ...d, location: locations.find((l)=>l.driver_id===d.id) || null, orders: orderRows.filter((o)=>String((o as Order & {driver_id?: string; assigned_driver_id?: string}).driver_id || (o as Order & {driver_id?: string; assigned_driver_id?: string}).assigned_driver_id)===d.id), trail: trails.filter((t)=>t.driver_id===d.id).slice(0,50).reverse() }))); setLoading(false); },[]);
 useEffect(()=>{ void refresh(); },[refresh]);
 useEffect(()=>{ const client = supabase; if(!client) return; const ch=client.channel("admin-driver-live").on("postgres_changes",{event:"*",schema:"public",table:"driver_locations"},()=>void refresh()).on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>void refresh()).subscribe(); return()=>{ void client.removeChannel(ch); };},[refresh]);
 return { drivers, loading, error, refresh };
}
