import { useEffect } from "react";

export default function ToastNotification({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 bg-[#232B42] text-white px-8 py-4 rounded-2xl shadow-lg text-lg font-semibold flex items-center gap-2 animate-fade-in-out">
      {message}
      {/* Animation CSS en fade/slide */}
      <style jsx>{`
        .animate-fade-in-out {
          animation: fadeInOut 5s cubic-bezier(0.4,0,0.2,1);
        }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(-20px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
