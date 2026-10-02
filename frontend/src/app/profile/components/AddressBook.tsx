import React from "react";
import { MapPin, Briefcase, Globe, Clipboard, Edit3, Trash2, Plus } from "lucide-react";
import { UserAddress } from "./types";

interface AddressBookProps {
  readonly addresses: readonly UserAddress[];
  readonly loadingAddresses: boolean;
  readonly openAddressModal: (address: UserAddress | null) => void;
  readonly handleDeleteAddress: (id: string) => void;
  readonly getAddressT: (key: string) => string;
}

export default function AddressBook({
  addresses,
  loadingAddresses,
  openAddressModal,
  handleDeleteAddress,
  getAddressT,
}: Readonly<AddressBookProps>) {
  const renderAddressContent = () => {
    if (loadingAddresses) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <div className="spinner animate-spin w-6 h-6 border-3 border-salmon-pink border-t-transparent rounded-full" />
          <span className="text-[10px] font-bold text-sonic-silver">{getAddressT("loading_addresses")}</span>
        </div>
      );
    }

    if (addresses.length === 0) {
      return (
        <div className="border-2 border-dashed border-cultured rounded-2xl p-10 text-center select-none">
          <MapPin className="w-8 h-8 text-spanish-gray mx-auto mb-2.5" />
          <p className="text-xs font-bold text-sonic-silver mb-4">
            {getAddressT("no_addresses_found")}
          </p>
          <button
            type="button"
            onClick={() => openAddressModal(null)}
            className="px-5 py-2.5 bg-salmon-pink text-white rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none shadow-md hover:bg-eerie-black active:scale-[0.98] transition-all cursor-pointer"
          >
            {getAddressT("add_new_address")}
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group ${
              addr.is_default ? "border-salmon-pink/30 bg-salmon-pink/[0.01]" : "border-cultured"
            }`}
          >
            {addr.is_default && (
              <span className="absolute top-4 right-4 bg-salmon-pink/10 text-salmon-pink text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-salmon-pink/20 tracking-wider">
                {getAddressT("default_badge")}
              </span>
            )}

            <div className="flex flex-col gap-2">
              {/* Card Header (Title & Badge) */}
              <div className="flex items-center gap-2">
                {addr.address_type === "billing" ? (
                  <Briefcase className="w-4 h-4 text-salmon-pink" />
                ) : (
                  <MapPin className="w-4 h-4 text-salmon-pink" />
                )}
                <span className="text-xs font-extrabold text-eerie-black truncate max-w-[150px]">
                  {addr.title}
                </span>
                <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                  addr.address_type === "billing"
                    ? "bg-purple-50 text-purple-600 border border-purple-100"
                    : "bg-blue-50 text-blue-600 border border-blue-100"
                }`}>
                  {addr.address_type === "billing" ? getAddressT("billing_address") : getAddressT("shipping_address")}
                </span>
              </div>

              {/* Recipient details */}
              <div className="text-xs font-extrabold text-eerie-black mt-1">
                {addr.first_name} {addr.last_name}
              </div>
              {addr.company_name && (
                <div className="text-[10px] font-bold text-sonic-silver truncate">
                  {addr.company_name}
                </div>
              )}

              {/* Address details */}
              <div className="text-[11px] font-medium text-sonic-silver leading-relaxed mt-1">
                {addr.address_line}
              </div>
              <div className="text-[10px] font-extrabold text-eerie-black flex items-center gap-1.5 mt-0.5">
                <Globe className="w-3.5 h-3.5 text-spanish-gray" />
                <span>
                  {addr.postal_code ? `${addr.postal_code} ` : ""}
                  {addr.city_name ? `${addr.city_name}, ` : ""}
                  {addr.state_name ? `${addr.state_name}, ` : ""}
                  {addr.country_name}
                </span>
              </div>

              <div className="text-[10px] font-bold text-sonic-silver truncate mt-0.5">
                📱 {addr.phone}
              </div>

              {/* Conditional Billing details */}
              {addr.address_type === "billing" && (addr.tax_no_tckn || addr.tax_office) && (
                <div className="mt-2 pt-2 border-t border-cultured text-[10px] font-semibold text-sonic-silver flex flex-col gap-0.5">
                  {addr.tax_no_tckn && (
                    <div className="flex items-center gap-1">
                      <Clipboard className="w-3 h-3 text-spanish-gray" />
                      <span>{getAddressT("tax_no_tckn_label")}: {addr.tax_no_tckn}</span>
                    </div>
                  )}
                  {addr.tax_office && (
                    <div>
                      🏢 {getAddressT("tax_office_label")}: {addr.tax_office}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Card Actions */}
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-cultured">
              <button
                type="button"
                onClick={() => openAddressModal(addr)}
                className="p-1.5 hover:bg-cultured text-sonic-silver hover:text-salmon-pink transition-all rounded border-none bg-transparent cursor-pointer flex items-center gap-1"
                title={getAddressT("edit_address")}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="text-[9px] font-extrabold uppercase">{getAddressT("edit_address")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (addr.id) {
                    handleDeleteAddress(addr.id);
                  }
                }}
                className="p-1.5 hover:bg-red-50 text-sonic-silver hover:text-red-500 transition-all rounded border-none bg-transparent cursor-pointer flex items-center gap-1"
                title={getAddressT("delete_address")}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[9px] font-extrabold uppercase">{getAddressT("delete_address")}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="border-t border-cultured pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-[11px] font-extrabold uppercase text-sonic-silver tracking-wider select-none mb-1">
            {getAddressT("address_book_header")}
          </h4>
          <p className="text-[10px] font-semibold text-sonic-silver select-none">
            {getAddressT("account_settings_desc")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAddressModal(null)}
          className="px-4 py-2 bg-salmon-pink/10 text-salmon-pink hover:bg-salmon-pink hover:text-white transition-all rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border border-salmon-pink/20 cursor-pointer flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          {getAddressT("add_new_address")}
        </button>
      </div>

      {renderAddressContent()}
    </div>
  );
}
