import type { SupabaseClient } from "npm:@supabase/supabase-js@2.108.2";
import type { ParsedTrack17Shipment } from "./track17-parser.ts";
import { statusCanAdvance, statusDescriptor } from "./track17-status.ts";

export async function findShipmentByTracking(supabase: SupabaseClient, trackingNumber: string, carrierCode: number) {
  const { data, error } = await supabase
    .from("international_shipments")
    .select("*")
    .eq("provider", "17track")
    .eq("carrier_code", carrierCode)
    .eq("tracking_number", trackingNumber)
    .maybeSingle();
  if (error) throw new Error(`shipment_lookup_failed:${error.message}`);
  return data;
}

export async function persistParsedShipment(
  supabase: SupabaseClient,
  shipment: Record<string, any>,
  parsed: ParsedTrack17Shipment,
  options: { webhook?: boolean; synced?: boolean; stopped?: boolean } = {},
) {
  const now = new Date().toISOString();
  const canAdvance = statusCanAdvance(
    Number(shipment.status_rank || 0),
    statusDescriptor(parsed.normalizedStatus),
    parsed.latestUpdateAt,
    shipment.latest_update_at,
  );

  const update: Record<string, unknown> = {
    last_webhook_at: options.webhook ? now : shipment.last_webhook_at,
    last_synced_at: options.synced ? now : shipment.last_synced_at,
    tracking_stopped_at: options.stopped ? now : shipment.tracking_stopped_at,
    latest_payload: parsed.rawPayload,
    origin_country: parsed.originCountry || shipment.origin_country,
    origin_city: parsed.originCity || shipment.origin_city,
    origin_coordinates: parsed.originCoordinates || shipment.origin_coordinates,
    destination_country: parsed.destinationCountry || shipment.destination_country,
    destination_city: parsed.destinationCity || shipment.destination_city,
    destination_coordinates: parsed.destinationCoordinates || shipment.destination_coordinates,
    estimated_delivery_at: parsed.estimatedDeliveryAt || shipment.estimated_delivery_at,
  };

  let statusChanged = false;
  if (canAdvance) {
    statusChanged = parsed.normalizedStatus !== shipment.normalized_status;
    Object.assign(update, {
      provider_status: parsed.providerStatus,
      provider_sub_status: parsed.providerSubStatus,
      normalized_status: parsed.normalizedStatus,
      status_rank: parsed.statusRank,
      latest_description: parsed.latestDescription,
      latest_location: parsed.latestLocation,
      latest_city: parsed.latestCity,
      latest_country: parsed.latestCountry,
      latest_coordinates: parsed.latestCoordinates,
      latest_update_at: parsed.latestUpdateAt || shipment.latest_update_at || now,
      delivered_at: parsed.normalizedStatus === "delivered"
        ? (parsed.latestUpdateAt || now)
        : shipment.delivered_at,
    });
  }

  const { error: updateError } = await supabase
    .from("international_shipments")
    .update(update)
    .eq("id", shipment.id);
  if (updateError) throw new Error(`shipment_update_failed:${updateError.message}`);

  if (parsed.events.length) {
    const eventRows = parsed.events.map((event) => ({
      shipment_id: shipment.id,
      provider_event_id: event.providerEventId,
      event_hash: event.eventHash,
      provider_status: event.providerStatus,
      provider_sub_status: event.providerSubStatus,
      normalized_status: event.normalizedStatus,
      status_rank: event.statusRank,
      description: event.description,
      description_ar: event.descriptionAr,
      location: event.location,
      city: event.city,
      state: event.state,
      country: event.country,
      postal_code: event.postalCode,
      longitude: event.longitude,
      latitude: event.latitude,
      event_time: event.eventTime,
      raw_payload: event.rawPayload,
    }));

    const { error: eventsError } = await supabase
      .from("international_tracking_events")
      .upsert(eventRows, { onConflict: "shipment_id,event_hash", ignoreDuplicates: true });
    if (eventsError) throw new Error(`tracking_events_upsert_failed:${eventsError.message}`);
  }

  if (statusChanged) {
    const status = statusDescriptor(parsed.normalizedStatus);
    // Best-effort bridge to the existing notification table. A schema mismatch is
    // deliberately ignored so tracking persistence can never be rolled back.
    try {
      await supabase.from("notifications").insert({
        title: `Aramex · ${status.en}`,
        message: `${status.ar}${parsed.latestLocation ? ` · ${parsed.latestLocation}` : ""}`,
        type: "international_tracking",
        is_read: false,
        metadata: {
          shipment_id: shipment.id,
          order_id: shipment.order_id,
          tracking_number: shipment.tracking_number,
          normalized_status: parsed.normalizedStatus,
        },
      });
    } catch {
      // Optional notification bridge only.
    }
  }

  return { statusChanged, appliedStatus: canAdvance };
}
