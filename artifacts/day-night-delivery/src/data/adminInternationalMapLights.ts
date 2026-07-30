export type AdminInternationalMapLight = {
  id: string;
  name: string;
  coordinates: [number, number];
  tier: "global" | "regional" | "city";
  tone: "gold" | "blue" | "white";
};

export const adminInternationalMapLights: AdminInternationalMapLight[] = [
  { id: "AUH", name: "Abu Dhabi", coordinates: [24.4539, 54.3773], tier: "global", tone: "gold" },
  { id: "DXB", name: "Dubai", coordinates: [25.2048, 55.2708], tier: "global", tone: "gold" },
  { id: "SHJ", name: "Sharjah", coordinates: [25.3463, 55.4209], tier: "regional", tone: "blue" },
  { id: "AAN", name: "Al Ain", coordinates: [24.1302, 55.8023], tier: "city", tone: "white" },
  { id: "RUH", name: "Riyadh", coordinates: [24.7136, 46.6753], tier: "global", tone: "gold" },
  { id: "JED", name: "Jeddah", coordinates: [21.4858, 39.1925], tier: "regional", tone: "blue" },
  { id: "DOH", name: "Doha", coordinates: [25.2854, 51.531], tier: "global", tone: "gold" },
  { id: "KWI", name: "Kuwait City", coordinates: [29.3759, 47.9774], tier: "regional", tone: "blue" },
  { id: "MCT", name: "Muscat", coordinates: [23.588, 58.3829], tier: "regional", tone: "blue" },
  { id: "BAH", name: "Manama", coordinates: [26.2235, 50.5876], tier: "regional", tone: "blue" },
  { id: "CAI", name: "Cairo", coordinates: [30.0444, 31.2357], tier: "regional", tone: "blue" },
  { id: "IST", name: "Istanbul", coordinates: [41.0082, 28.9784], tier: "global", tone: "gold" },
  { id: "LHR", name: "London", coordinates: [51.5072, -0.1276], tier: "global", tone: "gold" },
  { id: "CDG", name: "Paris", coordinates: [48.8566, 2.3522], tier: "global", tone: "gold" },
  { id: "FRA", name: "Frankfurt", coordinates: [50.1109, 8.6821], tier: "global", tone: "gold" },
  { id: "AMS", name: "Amsterdam", coordinates: [52.3676, 4.9041], tier: "regional", tone: "blue" },
  { id: "MAD", name: "Madrid", coordinates: [40.4168, -3.7038], tier: "regional", tone: "blue" },
  { id: "FCO", name: "Rome", coordinates: [41.9028, 12.4964], tier: "city", tone: "white" },
  { id: "SIN", name: "Singapore", coordinates: [1.3521, 103.8198], tier: "global", tone: "gold" },
  { id: "HKG", name: "Hong Kong", coordinates: [22.3193, 114.1694], tier: "global", tone: "gold" },
  { id: "PVG", name: "Shanghai", coordinates: [31.2304, 121.4737], tier: "global", tone: "gold" },
  { id: "TYO", name: "Tokyo", coordinates: [35.6762, 139.6503], tier: "global", tone: "gold" },
  { id: "ICN", name: "Seoul", coordinates: [37.5665, 126.978], tier: "regional", tone: "blue" },
  { id: "BKK", name: "Bangkok", coordinates: [13.7563, 100.5018], tier: "regional", tone: "blue" },
  { id: "BOM", name: "Mumbai", coordinates: [19.076, 72.8777], tier: "global", tone: "blue" },
  { id: "DEL", name: "Delhi", coordinates: [28.6139, 77.209], tier: "regional", tone: "blue" },
  { id: "JFK", name: "New York", coordinates: [40.7128, -74.006], tier: "global", tone: "gold" },
  { id: "LAX", name: "Los Angeles", coordinates: [34.0522, -118.2437], tier: "global", tone: "gold" },
  { id: "ORD", name: "Chicago", coordinates: [41.8781, -87.6298], tier: "regional", tone: "blue" },
  { id: "MIA", name: "Miami", coordinates: [25.7617, -80.1918], tier: "regional", tone: "blue" },
  { id: "YYZ", name: "Toronto", coordinates: [43.6532, -79.3832], tier: "regional", tone: "blue" },
  { id: "GRU", name: "São Paulo", coordinates: [-23.5505, -46.6333], tier: "regional", tone: "white" },
  { id: "NBO", name: "Nairobi", coordinates: [-1.2921, 36.8219], tier: "city", tone: "white" },
  { id: "JNB", name: "Johannesburg", coordinates: [-26.2041, 28.0473], tier: "regional", tone: "white" },
  { id: "SYD", name: "Sydney", coordinates: [-33.8688, 151.2093], tier: "global", tone: "gold" },
  { id: "MEL", name: "Melbourne", coordinates: [-37.8136, 144.9631], tier: "city", tone: "white" },
];

export const adminInternationalNetworkPreviewRoutes: Array<{
  id: string;
  from: [number, number];
  to: [number, number];
}> = [
  { id: "auh-lhr", from: [24.4539, 54.3773], to: [51.5072, -0.1276] },
  { id: "auh-sin", from: [24.4539, 54.3773], to: [1.3521, 103.8198] },
  { id: "auh-fra", from: [24.4539, 54.3773], to: [50.1109, 8.6821] },
  { id: "auh-ruh", from: [24.4539, 54.3773], to: [24.7136, 46.6753] },
  { id: "auh-cai", from: [24.4539, 54.3773], to: [30.0444, 31.2357] },
  { id: "auh-jfk", from: [24.4539, 54.3773], to: [40.7128, -74.006] },
  { id: "auh-syd", from: [24.4539, 54.3773], to: [-33.8688, 151.2093] },
  { id: "dxb-bom", from: [25.2048, 55.2708], to: [19.076, 72.8777] },
];
