import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L, { type LeafletEventHandlerFnMap } from "leaflet";
import { Marker, useMapEvents } from "react-leaflet";
import vehicleUrl from "../../assets/daynight/vehicle/daynight-rush.svg";
import "../../styles/dn-vehicle-marker-system.css";
import {
  calculateBearing,
  easeOutCubic,
  normalizeBearing,
  vehicleSizeForZoom,
  type LatLngTuple,
} from "./VehicleAnimations";

export type DayNightVehicleState = "driving" | "stopped" | "assignment" | "selected" | "offline" | "emergency";

export type DayNightVehicleMarkerProps = {
  position: LatLngTuple;
  bearing?: number | null;
  state?: DayNightVehicleState;
  label?: string;
  selected?: boolean;
  navigationMode?: boolean;
  size?: number;
  animate?: boolean;
  eventHandlers?: LeafletEventHandlerFnMap;
  zIndexOffset?: number;
  children?: ReactNode;
};

function escapeAttribute(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] || character));
}

export function createDayNightVehicleIcon({
  bearing = 0,
  size = 40,
  state = "driving",
  label = "DAY NIGHT vehicle",
  selected = false,
}: {
  bearing?: number;
  size?: number;
  state?: DayNightVehicleState;
  label?: string;
  selected?: boolean;
}) {
  const resolvedState = selected ? "selected" : state;
  const safeLabel = escapeAttribute(label);
  const safeBearing = normalizeBearing(bearing);

  return L.divIcon({
    className: "dn-official-vehicle-leaflet-icon",
    html: `<span class="dn-official-vehicle is-${resolvedState}" style="--dn-vehicle-size:${size}px;--dn-vehicle-bearing:${safeBearing}deg" role="img" aria-label="${safeLabel}"><span class="dn-official-vehicle__pulse" aria-hidden="true"></span><img class="dn-official-vehicle__image" src="${vehicleUrl}" width="${size}" height="${size}" alt="" decoding="async" draggable="false" /></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

function useSmoothPosition(target: LatLngTuple, enabled: boolean) {
  const [position, setPosition] = useState<LatLngTuple>(target);
  const currentRef = useRef<LatLngTuple>(target);

  useEffect(() => {
    const start = currentRef.current;
    if (!enabled || typeof window === "undefined" || (start[0] === target[0] && start[1] === target[1])) {
      currentRef.current = target;
      setPosition(target);
      return;
    }

    const startedAt = performance.now();
    const duration = 420;
    let frame = 0;

    const tick = (now: number) => {
      const progress = easeOutCubic((now - startedAt) / duration);
      const next: LatLngTuple = [
        start[0] + (target[0] - start[0]) * progress,
        start[1] + (target[1] - start[1]) * progress,
      ];
      currentRef.current = next;
      setPosition(next);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, target[0], target[1]]);

  return position;
}

export const DayNightVehicleMarker = memo(function DayNightVehicleMarker({
  position,
  bearing,
  state = "driving",
  label = "DAY NIGHT vehicle",
  selected = false,
  navigationMode = false,
  size,
  animate = true,
  eventHandlers,
  zIndexOffset = 1000,
  children,
}: DayNightVehicleMarkerProps) {
  const previousTargetRef = useRef<LatLngTuple>(position);
  const [zoom, setZoom] = useState(12);
  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  useEffect(() => {
    setZoom(map.getZoom());
  }, [map]);

  const resolvedSize = size || vehicleSizeForZoom(zoom, navigationMode);
  const resolvedBearing = bearing == null ? calculateBearing(previousTargetRef.current, position) : normalizeBearing(bearing);
  const smoothPosition = useSmoothPosition(position, animate);

  useEffect(() => {
    previousTargetRef.current = position;
  }, [position[0], position[1]]);

  const icon = useMemo(
    () => createDayNightVehicleIcon({
      bearing: resolvedBearing,
      size: resolvedSize,
      state,
      label,
      selected,
    }),
    [label, resolvedBearing, resolvedSize, selected, state],
  );

  return (
    <Marker
      position={smoothPosition}
      icon={icon}
      eventHandlers={eventHandlers}
      zIndexOffset={zIndexOffset}
      keyboard
      riseOnHover
    >
      {children}
    </Marker>
  );
});

export default DayNightVehicleMarker;
