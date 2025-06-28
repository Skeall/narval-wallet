import { useEffect, useState } from "react";

function getNextMidnight(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
}

function getCountdownString(target: Date): string {
  const now = new Date();
  let diff = Math.max(0, target.getTime() - now.getTime());
  const hours = Math.floor(diff / 3_600_000);
  diff -= hours * 3_600_000;
  const mins = Math.floor(diff / 60_000);
  diff -= mins * 60_000;
  const secs = Math.floor(diff / 1000);
  return `${hours}h ${mins.toString().padStart(2, '0')}min ${secs.toString().padStart(2, '0')}s`;
}

export default function LiveCountdown() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  const target = getNextMidnight();
  return (
    <span>
      Nouvelle piñata dans : <span className="font-semibold text-sky-300">{getCountdownString(target)}</span>
    </span>
  );
}
