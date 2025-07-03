import React from "react";

interface BetAcceptCardProps {
  pari: any;
  onAccept: () => Promise<void>;
  onRefuse: () => Promise<void>;
  actionMsg: string;
  joueur1Pseudo: string;
}

export default function BetAcceptCard({ pari, onAccept, onRefuse, actionMsg, joueur1Pseudo }: BetAcceptCardProps) {
  return (
    <div className="bg-gradient-to-br from-blue-900/80 via-blue-800/70 to-cyan-900/80 border border-blue-400/30 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col items-center animate-fadeIn hover:scale-[1.025] transition-transform duration-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1 bg-blue-700/80 text-cyan-100 text-xs font-semibold px-3 py-1 rounded-full shadow-md">
          <span className="material-symbols-rounded text-base align-middle">hourglass_top</span>
          Nouveau pari à valider
        </span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-lg font-bold text-white shadow overflow-hidden">
          {pari.joueur1?.avatar ? (
            <img
              src={pari.joueur1.avatar}
              alt={joueur1Pseudo || 'Avatar'}
              className="object-cover w-full h-full"
              style={{ minWidth: 32, minHeight: 32 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            (joueur1Pseudo || 'U')[0].toUpperCase()
          )}
        </div>
        <span className="text-base text-cyan-100 font-medium">
          <span className="font-bold text-cyan-300">{joueur1Pseudo || "Un joueur"}</span> te propose un pari de
        </span>
        <span className="text-xl font-extrabold text-cyan-300">₦{pari.montant}</span>
      </div>
      {pari.description && (
        <div className="mb-3 px-4 py-2 rounded-xl bg-blue-950/60 text-cyan-200 text-sm font-medium italic text-center border border-cyan-900/30 shadow-inner">
          <span className="material-symbols-rounded align-middle mr-1 text-cyan-300 text-base">chat_bubble</span>
          {pari.description}
        </div>
      )}
      <div className="flex gap-4 mt-2 w-full justify-center">
        <button
          className="group/button bg-gradient-to-r from-cyan-500/90 to-blue-500/80 hover:from-cyan-400 hover:to-blue-400 text-white font-bold py-2 px-8 rounded-full shadow-lg shadow-cyan-900/20 border border-cyan-400/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/80 transition-all duration-150 active:scale-95 select-none flex items-center gap-2 text-base"
          title="Accepter le pari"
          onClick={onAccept}
        >
          <span className="material-symbols-rounded text-lg">check_circle</span>
          Accepter
        </button>
        <button
          className="group/button bg-gradient-to-r from-red-600/90 to-red-800/80 hover:from-red-500 hover:to-red-700 text-white font-bold py-2 px-8 rounded-full shadow-lg shadow-red-900/20 border border-red-400/30 focus:outline-none focus:ring-2 focus:ring-red-400/80 transition-all duration-150 active:scale-95 select-none flex items-center gap-2 text-base"
          title="Refuser le pari"
          onClick={onRefuse}
        >
          <span className="material-symbols-rounded text-lg">cancel</span>
          Refuser
        </button>
      </div>
      {actionMsg && <div className="mt-4 text-center text-cyan-200 text-sm">{actionMsg}</div>}
    </div>
  );
}
