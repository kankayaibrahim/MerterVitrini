import { RefreshCw, Settings, LogOut, User, Menu, Globe } from "lucide-react";
import { UserInfo } from "../../types/integration";

// Localized labels dictionary to prevent JSX literal internationalization warnings
const LABELS = {
  logoText: "MV",
  title: "Merter Vitrini",
  subtitle: "Toptan XML Entegrasyon & Yönetim",
  database: "Veritabanı: ",
  dbConnected: "Bağlı",
  dbDisconnected: "Bağlantı Yok",
  dbChecking: "Kontrol Ediliyor",
  apiAddress: "Backend API Adresi",
  applyAndRefresh: "Uygula & Yenile",
  apiExplanation: "Next.js uygulamanız statik derleme ile çalıştığı için lokalde veya uzakta çalışan Go backend servisinize API isteklerini doğrudan tarayıcı üzerinden gönderir.",
  logoutButton: "Çıkış Yap",
  viewSite: "Siteyi Görüntüle"
};

interface HeaderProps {
  dbStatus: "connected" | "disconnected" | "checking";
  checkDbConnection: () => Promise<void>;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  onApplySettings: () => void;
  user: UserInfo | null;
  onLogout: () => void;
  onMenuToggle?: () => void;
}

export default function Header({
  dbStatus,
  checkDbConnection,
  showSettings,
  setShowSettings,
  apiUrl,
  setApiUrl,
  onApplySettings,
  user,
  onLogout,
  onMenuToggle
}: HeaderProps) {
  return (
    <>
      {/* Header Settings Bar */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-zinc-200/60 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <button 
              onClick={onMenuToggle}
              className="lg:hidden p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 shadow-sm transition-all mr-1 shrink-0 cursor-pointer"
              type="button"
            >
              <Menu size={18} />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20 font-bold text-lg shrink-0">
            {LABELS.logoText}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">{LABELS.title}</h1>
            <p className="text-xs font-medium text-zinc-500">{LABELS.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* View Site Button */}
          <a
            href="https://mertervitrini.com.tr"
            target="_blank"
            rel="noopener noreferrer"
            title={LABELS.viewSite}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:text-violet-600 text-zinc-700 shadow-sm text-xs font-bold transition-all cursor-pointer"
          >
            <Globe size={16} />
            <span className="hidden md:inline">{LABELS.viewSite}</span>
          </a>

          {/* DB Health Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200/50 text-xs font-semibold">
            <span className={`w-2.5 h-2.5 rounded-full ${
              dbStatus === "connected" ? "bg-emerald-500 animate-pulse" :
              dbStatus === "disconnected" ? "bg-rose-500 animate-pulse" : "bg-amber-500 animate-pulse"
            }`} />
            <span>{LABELS.database}</span>
            <span className={dbStatus === "connected" ? "text-emerald-700" : dbStatus === "disconnected" ? "text-rose-700" : "text-amber-700"}>
              {dbStatus === "connected" ? LABELS.dbConnected : dbStatus === "disconnected" ? LABELS.dbDisconnected : LABELS.dbChecking}
            </span>
            <button onClick={checkDbConnection} title="Bağlantıyı Yenile" className="p-0.5 hover:bg-zinc-200 rounded transition-colors text-zinc-500">
              <RefreshCw size={12} className={dbStatus === "checking" ? "animate-spin" : ""} />
            </button>
          </div>

          {/* User Profile & Logout Button (If logged in) */}
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600">
                  <User size={14} />
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-zinc-800 leading-tight">
                    {user.first_name} {user.last_name}
                  </span>
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider leading-none">
                    {user.role}
                  </span>
                </div>
              </div>

              <button 
                onClick={onLogout}
                title={LABELS.logoutButton}
                className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 shadow-sm transition-all cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}

          {/* Config URL Button */}
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl border transition-all ${
              showSettings ? "bg-violet-50 text-violet-600 border-violet-200" : "bg-white border-zinc-200/80 hover:bg-zinc-50 text-zinc-600 shadow-sm"
            }`}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Backend Settings Overlay dropdown */}
      {showSettings && (
        <div className="mx-6 mt-4 p-4 glass-card bg-white rounded-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex-1">
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{LABELS.apiAddress}</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="Örn: http://localhost:8080"
                className="flex-1 max-w-md px-3 py-1.5 rounded-xl border border-zinc-300/80 bg-zinc-50 text-sm focus:outline-none focus:border-violet-500 focus:bg-zinc-950/70 focus:bg-white transition-all font-mono"
              />
              <button 
                onClick={onApplySettings}
                className="px-4 py-1.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                {LABELS.applyAndRefresh}
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-500 max-w-sm">
            {LABELS.apiExplanation}
          </p>
        </div>
      )}
    </>
  );
}
