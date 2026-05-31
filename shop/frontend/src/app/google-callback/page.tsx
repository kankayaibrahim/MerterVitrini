"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Home } from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import { Category, CartItem } from "@/types/store";
import { apiFetch } from "@/app/utils";

function GoogleCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [lang, setLang] = useState<string>("tr");
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    // Load language, currency, cart & categories for header/footer consistency
    if (typeof window !== "undefined") {
      setLang(localStorage.getItem("preferred_lang") || "tr");
      setDisplayCurrency(localStorage.getItem("merter_preferred_currency") || "TRY");
      
      const savedCart = localStorage.getItem("merter_b2b_cart");
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (e) {
          console.error(e);
        }
      }
    }

    const loadCategories = async () => {
      const data = await apiFetch<Category[]>("/categories");
      if (data) setCategories(data);
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const code = searchParams.get("code");
    
    if (!code) {
      setError("Doğrulama kodu (code) bulunamadı. Lütfen tekrar giriş yapmayı deneyin.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const origin = window.location.origin;
        const redirectUri = `${origin}/google-callback/`;
        
        const response = await fetch(`/api/v1/store/auth/google-callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Google yetkilendirme kod doğrulaması başarısız oldu.");
        }

        // Save token & user to localStorage
        localStorage.setItem("store_user_token", data.token);
        localStorage.setItem("store_user_info", JSON.stringify(data.user));

        // Dispatch auth-change event to update headers
        window.dispatchEvent(new Event("auth-change"));

        setSuccess(true);
        
        // Redirect to homepage or profile
        setTimeout(() => {
          router.push("/profile/");
        }, 1500);

      } catch (err: any) {
        setError(err.message || "Google ile oturum açılırken beklenmedik bir hata oluştu.");
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={false}
        setIsLangOpen={() => {}}
        totalPkgs={totalPkgs}
        setIsCartOpen={() => {}}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={setActiveCategoryId}
        categories={categories}
        activeCategoryId={activeCategoryId}
        displayCurrency={displayCurrency}
        onCurrencyChange={() => {}}
      />

      <main className="flex-grow flex flex-col items-center justify-center p-6 sm:p-12 select-none py-24">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-cultured rounded-2xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          {!error && !success && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-salmon-pink animate-spin" />
              </div>
              <h2 className="text-lg font-extrabold text-eerie-black mt-2">
                {lang === "tr" ? "Google ile Oturum Açılıyor..." : "Signing in with Google..."}
              </h2>
              <p className="text-xs font-semibold text-sonic-silver max-w-xs leading-relaxed">
                {lang === "tr" 
                  ? "Kimliğiniz doğrulanıyor ve B2B hesabınız senkronize ediliyor. Lütfen bekleyin."
                  : "Verifying your identity and synchronizing your B2B account. Please wait."}
              </p>
            </div>
          )}

          {success && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-bounce" />
              <h2 className="text-lg font-extrabold text-eerie-black mt-2">
                {lang === "tr" ? "Giriş Başarılı!" : "Sign In Successful!"}
              </h2>
              <p className="text-xs font-semibold text-emerald-600 max-w-xs leading-relaxed">
                {lang === "tr" 
                  ? "Profilinize yönlendiriliyorsunuz. Keyifli alışverişler dileriz."
                  : "You are being redirected to your profile. Have a nice shopping."}
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
              <AlertCircle className="w-16 h-16 text-red-500 animate-shake" />
              <h2 className="text-lg font-extrabold text-eerie-black mt-2">
                {lang === "tr" ? "Giriş Başarısız" : "Sign In Failed"}
              </h2>
              <p className="text-xs font-semibold text-red-600 max-w-xs leading-relaxed">
                {error}
              </p>
              
              <div className="w-full border-t border-cultured my-4" />
              
              <a 
                href="/" 
                className="w-full py-3 bg-eerie-black hover:bg-salmon-pink text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center gap-2 no-underline"
              >
                <Home className="w-4 h-4" />
                <span>{lang === "tr" ? "Ana Sayfaya Dön" : "Back to Homepage"}</span>
              </a>
            </div>
          )}
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="spinner animate-spin w-8 h-8 border-4 border-salmon-pink border-t-transparent rounded-full" />
      </div>
    }>
      <GoogleCallbackHandler />
    </Suspense>
  );
}
