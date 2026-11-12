import React, { useState } from "react";
import { Share2 } from "lucide-react";
import { normalizeSeoLang, SITE_ORIGIN } from "@/utils/seoHelpers";

interface SocialShareProps {
  readonly title: string;
  readonly lang: string;
  readonly t: (key: string, lang: string) => string;
  readonly productSlug?: string;
}

export default function SocialShare({
  title,
  lang,
  t,
  productSlug,
}: SocialShareProps) {
  const [showToast, setShowToast] = useState<boolean>(false);

  const safeLang = normalizeSeoLang(lang, "tr");
  const slugSegment = productSlug ? `/product/${encodeURIComponent(productSlug)}` : "";
  const langQuery = safeLang !== "tr" && slugSegment ? `?lang=${safeLang}` : "";
  const effectiveUrl = `${SITE_ORIGIN}${slugSegment}${langQuery}`;
  const shareText = encodeURIComponent(`${title} - ${effectiveUrl}`);
  const shareUrl = encodeURIComponent(effectiveUrl);

  return (
    <div className="border-t border-[#E5E0D8] pt-5 flex flex-col gap-3 mt-2">
      <span className="text-[11px] uppercase font-extrabold text-[#1C1C1C] tracking-[0.5px] block select-none">
        {t("share_product", lang)}
      </span>

      <div className="flex items-center gap-3 flex-wrap">
        {/* WhatsApp */}
        <a
          href={`https://api.whatsapp.com/send?text=${shareText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#15803D] transition-colors cursor-pointer"
          title="WhatsApp"
          aria-label="WhatsApp"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.73.001-2.595-1.006-5.035-2.836-6.87C16.671 2.16 14.237.986 11.64.985c-5.441 0-9.87 4.372-9.873 9.734-.001 1.709.467 3.376 1.354 4.887l-.982 3.582 3.71-.974zm13.14-5.932c-.3-.15-1.776-.875-2.05-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-1.127-.566-1.929-1.009-2.694-2.321-.202-.347-.202-.656-.051-.951.136-.264.3-.35.45-.5.15-.15.2-.25.3-.45.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.588-.491-.508-.675-.518-.175-.009-.375-.01-.575-.01-.2 0-.525.075-.8 1.025-.275.95-1.05 3.3-1.05 3.4 0 .1.075.2.225.35.15.15 1.75 2.673 4.237 3.743.592.255 1.054.408 1.413.523.595.19 1.137.163 1.564.1.477-.07 1.475-.603 1.675-1.18.2-.578.2-1.075.14-1.18-.06-.1-.225-.15-.525-.3z" />
          </svg>
        </a>

        {/* X (Twitter) */}
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${shareUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-[#F8F6F2] hover:bg-[#EFECE6] border border-[#E5E0D8] flex items-center justify-center text-[#1C1C1C] transition-colors cursor-pointer"
          title="X (Twitter)"
          aria-label="X (Twitter)"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>

        {/* Facebook */}
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-[#F8F6F2] hover:bg-[#EFECE6] border border-[#E5E0D8] flex items-center justify-center text-[#1C1C1C] transition-colors cursor-pointer"
          title="Facebook"
          aria-label="Facebook"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
          </svg>
        </a>

        {/* Copy Link */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              const urlToCopy = window.location.href || effectiveUrl;
              void navigator.clipboard.writeText(urlToCopy);
              setShowToast(true);
              setTimeout(() => setShowToast(false), 2000);
            }
          }}
          className="w-10 h-10 rounded-full bg-[#F8F6F2] hover:bg-[#EFECE6] border border-[#E5E0D8] flex items-center justify-center text-[#1C1C1C] transition-colors cursor-pointer"
          title={t("copy_link", lang)}
          aria-label={t("copy_link", lang)}
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Toast Notification */}
        {showToast && (
          <span className="text-[10px] font-extrabold text-[#6E542E] bg-[#FAF7F2] px-3 py-1.5 rounded-md border border-[#D8C7A6] select-none">
            {t("link_copied", lang)}
          </span>
        )}
      </div>
    </div>
  );
}
