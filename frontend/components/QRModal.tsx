'use client';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
}

export default function QRModal({ isOpen, onClose, url }: QRModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">QR Code Share</h3>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="aspect-square w-full rounded-2xl bg-white p-6 border border-slate-100 dark:border-slate-800 flex items-center justify-center shadow-inner overflow-hidden group">
             <img 
               src={`/api/share/qrcode?url=${encodeURIComponent(url)}`} 
               alt="QR Code"
               className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal transform transition-transform group-hover:scale-105"
             />
          </div>

          <div className="mt-8 space-y-4">
            <div className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Form URL</span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 break-all block leading-relaxed">{url}</span>
            </div>
            
            <button
               onClick={onClose}
               className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
