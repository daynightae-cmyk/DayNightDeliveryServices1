import { memo } from "react";
import { Polyline } from "react-leaflet";
import type { LatLngTuple } from "./VehicleAnimations";

export const VehicleTrail = memo(function VehicleTrail({
  positions,
  selected = false,
}: {
  positions: LatLngTuple[];
  selected?: boolean;
}) {
  if (positions.length < 2) return null;

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color: "#0B5FFF",
          weight: selected ? 8 : 6,
          opacity: selected ? 0.28 : 0.2,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Polyline
        positions={positions}
        pathOptions={{
          color: "#18A8E8",
          weight: selected ? 4 : 3,
          opacity: selected ? 0.75 : 0.55,
          dashArray: "12 14",
          lineCap: "round",
          lineJoin: "round",
        }}
      />
    </>
  );
});

export default VehicleTrail;
