"use client";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

const navItems = [
  {
    label: "Home",
    href: "/",
    icon: (
      <img src="/icons/home.svg" alt="Accueil" width={24} height={24} className="mx-auto" />
    ),
  },
  {
    label: "Events",
    href: "/events",
    icon: (
      <img src="/icons/events.svg" alt="Événements" width={24} height={24} className="mx-auto" />
    ),
  },
  {
    label: "Parier",
    href: "/pari",
    icon: (
      <img src="/icons/parier.svg" alt="Parier" width={28} height={28} className="mx-auto" />
    ),
    cta: true,
  },
  {
    label: "Souvenirs",
    href: "/souvenirs",
    icon: (
      <img src="/icons/souvenirs.svg" alt="Souvenirs" width={24} height={24} className="mx-auto" />
    ),
  },
  {
    label: "Specials",
    href: "/specials",
    icon: (
      <img src="/icons/specials.svg" alt="Spéciales" width={24} height={24} className="mx-auto" />
    ),
  },
];

export default function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F1C] border-t border-[#232B42] shadow-[0_-2px_12px_0_rgba(0,0,0,0.25)] px-2 pb-safe pt-1 flex justify-between items-end md:hidden" style={{height: 70}}>
      {navItems.map((item, idx) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        if (item.cta) {
          // Central CTA
          return (
            <button
              key={item.href}
              aria-label={item.label}
              onClick={() => router.push(item.href)}
              className={clsx(
                "relative flex flex-col items-center justify-center rounded-full shadow-lg transition-all duration-150",
                "bg-gradient-to-tr from-sky-400 to-blue-700 text-white",
                "-translate-y-6 z-10",
                "w-16 h-16",
                "border-4 border-[#0B0F1C]",
                isActive ? "ring-2 ring-white" : "opacity-95 hover:opacity-100"
              )}
              style={{ minWidth: 56, minHeight: 56 }}
            >
              <span className="flex items-center justify-center w-10 h-10">
                <img
                  src={item.icon.props.src}
                  alt={item.icon.props.alt}
                  width={28}
                  height={28}
                  className="mx-auto brightness-0 invert"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </span>
            </button>
          );
        }
        // Boutons latéraux
        return (
          <button
            key={item.href}
            aria-label={item.label}
            onClick={() => router.push(item.href)}
            className={clsx(
              "flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-0 mb-4",
              isActive ? "text-white" : "text-gray-400"
            )}
            style={{ fontSize: 0 }}
          >
            <span className="flex items-center justify-center w-6 h-6">
              <img
                src={item.icon.props.src}
                alt={item.icon.props.alt}
                width={24}
                height={24}
                className={clsx(
                  "mx-auto",
                  isActive ? "filter-none" : "grayscale brightness-[1.7]"
                )}
                style={{ filter: isActive ? "none" : "grayscale(1) brightness(1.7)" }}
              />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
