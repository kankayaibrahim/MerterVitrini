"use client";

import React, { useState, useEffect } from "react";
import { X, Lock, Mail, User, Phone, Check, AlertCircle } from "lucide-react";
import { t } from "@/app/i18n";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
  initialMode?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, lang, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteHp, setWebsiteHp] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load Google reCAPTCHA v3 script dynamically
  useEffect(() => {
    if (isOpen) {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      if (!siteKey) {
        console.warn("reCAPTCHA site key is missing in env configurations.");
        return;
      }

      const scriptId = "recaptcha-v3-script";
      let script = document.getElementById(scriptId) as HTMLScriptElement;
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}&hl=${lang}`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }
  }, [isOpen, lang]);

  const executeCaptcha = async (actionName: string): Promise<string> => {
    return new Promise((resolve) => {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      if (!siteKey) {
        resolve("");
        return;
      }

      const grecaptcha = (window as any).grecaptcha;
      if (!grecaptcha) {
        console.warn("reCAPTCHA script has not loaded yet.");
        resolve("");
        return;
      }

      grecaptcha.ready(() => {
        grecaptcha.execute(siteKey, { action: actionName })
          .then((token: string) => {
            resolve(token);
          })
          .catch((err: any) => {
            console.error("reCAPTCHA execution error:", err);
            resolve("");
          });
      });
    });
  };

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setSuccess(null);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setWebsiteHp("");
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const captchaToken = await executeCaptcha("login");

      const response = await fetch("/api/v1/store/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captcha_token: captchaToken, website_hp: websiteHp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.");
      }

      // Save to localStorage
      localStorage.setItem("store_user_token", data.token);
      localStorage.setItem("store_user_info", JSON.stringify(data.user));

      setSuccess("Başarıyla giriş yapıldı! Yönlendiriliyorsunuz...");
      
      // Dispatch custom event to let other components know
      window.dispatchEvent(new Event("auth-change"));

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Şifreler uyuşmuyor.");
      return;
    }

    setLoading(true);

    try {
      const captchaToken = await executeCaptcha("register");

      const response = await fetch("/api/v1/store/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          password,
          captcha_token: captchaToken,
          website_hp: websiteHp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Kayıt işlemi gerçekleştirilemedi.");
      }

      // Save user if auto-logged in
      if (data.token && data.user) {
        localStorage.setItem("store_user_token", data.token);
        localStorage.setItem("store_user_info", JSON.stringify(data.user));
        setSuccess("Kayıt başarıyla oluşturuldu ve giriş yapıldı!");
        window.dispatchEvent(new Event("auth-change"));
      } else {
        setSuccess("Kayıt başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.");
        setMode("login");
      }

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Translucent overlay */}
      <div 
        className="fixed inset-0 bg-eerie-black/40 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-2xl border border-cultured rounded-2xl shadow-2xl overflow-hidden z-10 transition-all duration-300 scale-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cultured px-6 py-4 bg-white/50">
          <div className="flex gap-4">
            <button
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccess(null);
              }}
              className={`text-sm font-extrabold tracking-wider uppercase transition-colors border-none bg-transparent cursor-pointer relative pb-1 ${
                mode === "login" 
                  ? "text-salmon-pink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-salmon-pink" 
                  : "text-sonic-silver hover:text-eerie-black"
              }`}
            >
              {t("login_title", lang) || "Giriş Yap"}
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError(null);
                setSuccess(null);
              }}
              className={`text-sm font-extrabold tracking-wider uppercase transition-colors border-none bg-transparent cursor-pointer relative pb-1 ${
                mode === "register" 
                  ? "text-salmon-pink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-salmon-pink" 
                  : "text-sonic-silver hover:text-eerie-black"
              }`}
            >
              {t("register_title", lang) || "Üye Ol"}
            </button>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-cultured rounded-full text-sonic-silver hover:text-eerie-black transition-colors cursor-pointer border-none bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="px-6 py-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 rounded-xl p-3 text-xs font-semibold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl p-3 text-xs font-semibold">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Honeypot field to catch spam bots */}
              <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
                <input
                  type="text"
                  name="website_hp"
                  value={websiteHp}
                  onChange={(e) => setWebsiteHp(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("email_label", lang) || "E-Posta Adresi"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder="ornek@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("password_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-sonic-silver">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="rounded text-salmon-pink focus:ring-salmon-pink" />
                  <span>{t("remember_me", lang)}</span>
                </label>
                <a href="#" className="hover:text-salmon-pink transition-colors">
                  {t("forgot_password", lang)}
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-eerie-black hover:bg-salmon-pink text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md disabled:bg-spanish-gray select-none active:scale-[0.98]"
              >
                {loading ? t("logging_in", lang) : t("login_title", lang)}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Honeypot field to catch spam bots */}
              <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
                <input
                  type="text"
                  name="website_hp"
                  value={websiteHp}
                  onChange={(e) => setWebsiteHp(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                    {t("first_name_label", lang)}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                      placeholder={t("first_name_placeholder", lang)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                    {t("last_name_label", lang)}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                      placeholder={t("last_name_placeholder", lang)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("email_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder={t("email_placeholder", lang)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("phone_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder={t("phone_placeholder", lang)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("password_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("confirm_password_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-start text-[11px] font-bold text-sonic-silver leading-relaxed">
                <label className="flex items-start gap-2 cursor-pointer mt-0.5">
                  <input type="checkbox" required className="rounded text-salmon-pink focus:ring-salmon-pink mt-0.5" />
                  <span>
                    {t("terms_accept_1", lang)}{" "}
                    <a href="#" className="text-salmon-pink underline hover:text-eerie-black transition-colors">
                      {t("terms_accept_2", lang)}
                    </a>{" "}
                    {t("terms_accept_3", lang)}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-eerie-black hover:bg-salmon-pink text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md disabled:bg-spanish-gray select-none active:scale-[0.98]"
              >
                {loading ? t("registering", lang) : t("register_title", lang)}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
