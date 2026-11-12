"use client";

import React from "react";
import { Users, Globe } from "lucide-react";
import { ChatRoom, resolveChatLang, SupplierAgent } from "@/types/chat";
import { pickLangText, SupportedLangCode } from "@/app/i18n";

const AGENT_SELECTOR_HEADERS: Record<SupportedLangCode, (count: number) => string> = {
  tr: (c) => `Tedarikçi Satış Temsilcileri (${c} Yetkili - Ayrı Sohbet):`,
  en: (c) => `Supplier Sales Representatives (${c} Agents - Direct Chat):`,
  ru: (c) => `Торговые представители поставщика (${c} спец. - отдельный чат):`,
  ar: (c) => `ممثلو مبيعات المورد (${c} مسؤول - محادثة منفصلة):`,
  de: (c) => `Vertriebsteam des Lieferanten (${c} Ansprechpartner - Einzelchat):`,
  fr: (c) => `Conseillers commerciaux du fournisseur (${c} agents - chat dédié) :`,
  pl: (c) => `Przedstawiciele handlowi dostawcy (${c} opiekunów - osobny czat):`,
  bg: (c) => `Търговски представители на доставчика (${c} експерти - отделен чат):`,
};

interface ChatAgentSelectorProps {
  readonly brandAgents: readonly SupplierAgent[];
  readonly activeRoom: ChatRoom | null;
  readonly selectedAgentId: string;
  readonly onSelectAgent: (agent: SupplierAgent) => void;
  readonly lang?: string;
}

export function ChatAgentSelector({
  brandAgents,
  activeRoom,
  selectedAgentId,
  onSelectAgent,
  lang,
}: Readonly<ChatAgentSelectorProps>) {
  if (brandAgents.length === 0) {
    return null;
  }

  const effectiveLang = resolveChatLang(lang);
  const headerText = pickLangText(effectiveLang, AGENT_SELECTOR_HEADERS)(brandAgents.length);

  return (
    <div className="bg-slate-900/95 border-t border-slate-800 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-2">
        <Users className="w-3.5 h-3.5" />
        <span>{headerText}</span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {brandAgents.map((agent) => {
          const isSelected =
            activeRoom?.supplier_user_id === agent.id ||
            (!activeRoom?.supplier_user_id && selectedAgentId === agent.id);
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelectAgent(agent)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-left transition-all cursor-pointer border ${
                isSelected
                  ? "bg-purple-600 text-white border-purple-400 shadow-sm"
                  : "bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-800"
              }`}
            >
              <div className="font-extrabold text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {agent.contact_name}
              </div>
              <div className="text-[10px] opacity-85 flex items-center gap-1 mt-0.5">
                <span>{agent.job_title}</span>
                {agent.spoken_languages && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-black/25 text-[9px] font-mono">
                    <Globe className="w-2.5 h-2.5" />
                    {agent.spoken_languages}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

