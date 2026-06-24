import { Clock, Zap } from "lucide-react";
import { useState, useEffect } from "react";

export default function GlobalClock() {
  const [times, setTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      setTimes({
        "New York": new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        "London": new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" })).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        "UAE": new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" })).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        "Singapore": new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" })).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      });
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {Object.entries(times).map(([city, time]) => (
        <div
          key={city}
          className="group backdrop-blur-xl bg-white/5 border border-white/20 rounded-xl p-4 hover:bg-white/10 hover:border-brand-gold/50 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-brand-gold group-hover:animate-spin" />
            <span className="text-xs text-white/60 font-semibold">{city}</span>
          </div>
          <p className="text-lg md:text-xl font-bold text-white text-center">{time}</p>
        </div>
      ))}
    </div>
  );
}
