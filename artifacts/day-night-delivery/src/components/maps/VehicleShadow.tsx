import { memo } from "react";

export const VehicleShadow = memo(function VehicleShadow({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 160" aria-hidden="true" focusable="false">
      <defs>
        <filter id="dnVehicleShadowBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <ellipse cx="80" cy="99" rx="44" ry="24" fill="#000814" opacity="0.28" filter="url(#dnVehicleShadowBlur)" />
    </svg>
  );
});

export default VehicleShadow;
