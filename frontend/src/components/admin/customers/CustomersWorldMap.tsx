"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Compass, Layers, MapPin } from "lucide-react";
import {
  CustomerMapPoint,
  CustomerMapSample,
  formatCurrencyTry,
} from "./customerTypes";

interface CustomersWorldMapProps {
  points: CustomerMapPoint[];
  selectedCountry: string;
  onFilterCountry: (countryCode: string) => void;
  onSelectCustomerById: (customerId: string) => void;
}

type TileMode = "osm" | "light";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMarkerPopupHtml(p: CustomerMapPoint): string {
  const titleCity = p.city ? `${escapeHtml(p.city)}, ` : "";
  const titleCountry = escapeHtml(p.country_name || p.country_code);
  const accuracyBadge = p.is_centroid
    ? `<span style="display:inline-block;padding:2px 6px;border-radius:9999px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:600;">Ülke Merkezi (Alan Kodu)</span>`
    : `<span style="display:inline-block;padding:2px 6px;border-radius:9999px;background:#dcfce7;color:#166534;font-size:10px;font-weight:600;">Doğrulanmış Şehir Konumu</span>`;

  const samplesHtml = p.sample_customers
    .slice(0, 4)
    .map((s) => {
      const todayBadge = s.registered_today
        ? `<span style="padding:1px 5px;border-radius:9999px;background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;margin-left:4px;">BUGÜN</span>`
        : "";
      const onlineDot = s.is_online
        ? `<span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:#10b981;margin-right:4px;"></span>`
        : "";
      return `
        <button type="button" data-osm-customer="${escapeHtml(s.id)}" style="display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;padding:5px 7px;margin-top:4px;border-radius:8px;border:1px solid #e4e4e7;background:#fafafa;cursor:pointer;font-size:11px;color:#18181b;">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">${onlineDot}${escapeHtml(s.name || s.email)}${todayBadge}</span>
          <span style="color:#71717a;font-size:10px;margin-left:6px;flex-shrink:0;">${s.orders_count > 0 ? `${s.orders_count} sip.` : "Detay →"}</span>
        </button>
      `;
    })
    .join("");

  return `
    <div style="min-width:235px;max-width:270px;font-family:Inter,system-ui,sans-serif;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#09090b;">${titleCity}${titleCountry}</div>
          <div style="margin-top:2px;">${accuracyBadge}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0;padding:7px;border-radius:10px;background:#f4f4f5;text-align:center;">
        <div>
          <div style="font-size:14px;font-weight:700;color:#18181b;">${p.customer_count}</div>
          <div style="font-size:10px;color:#71717a;">Müşteri</div>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:${p.today_count > 0 ? "#059669" : "#18181b"};">${p.today_count}</div>
          <div style="font-size:10px;color:#71717a;">Bugün</div>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#4f46e5;">${p.orders_count}</div>
          <div style="font-size:10px;color:#71717a;">Sipariş</div>
        </div>
      </div>
      ${
        p.total_spend > 0
          ? `<div style="font-size:11px;color:#3f3f46;margin-bottom:6px;">Toplam B2B Hacmi: <strong>${escapeHtml(formatCurrencyTry(p.total_spend))}</strong></div>`
          : ""
      }
      ${samplesHtml ? `<div style="margin-top:6px;">${samplesHtml}</div>` : ""}
      <button type="button" data-osm-country="${escapeHtml(p.country_code)}" style="margin-top:8px;width:100%;padding:6px 10px;border-radius:8px;border:none;background:#18181b;color:#ffffff;font-size:11px;font-weight:600;cursor:pointer;">
        ${escapeHtml(p.country_name || p.country_code)} Müşterilerini Filtrele
      </button>
    </div>
  `;
}

function clusterPointsByCountry(points: CustomerMapPoint[]): CustomerMapPoint[] {
  const buckets = new Map<
    string,
    {
      points: CustomerMapPoint[];
      weightedLat: number;
      weightedLon: number;
      totalWeight: number;
      customerCount: number;
      todayCount: number;
      onlineCount: number;
      ordersCount: number;
      totalSpend: number;
      allCentroid: boolean;
      samples: CustomerMapSample[];
      seenSampleIds: Set<string>;
    }
  >();

  for (const p of points) {
    const code = (p.country_code || "UNKNOWN").toUpperCase();
    const weight = Math.max(1, p.customer_count);
    let bucket = buckets.get(code);
    if (!bucket) {
      bucket = {
        points: [],
        weightedLat: 0,
        weightedLon: 0,
        totalWeight: 0,
        customerCount: 0,
        todayCount: 0,
        onlineCount: 0,
        ordersCount: 0,
        totalSpend: 0,
        allCentroid: true,
        samples: [],
        seenSampleIds: new Set<string>(),
      };
      buckets.set(code, bucket);
    }

    bucket.points.push(p);
    bucket.weightedLat += p.lat * weight;
    bucket.weightedLon += p.lon * weight;
    bucket.totalWeight += weight;
    bucket.customerCount += p.customer_count;
    bucket.todayCount += p.today_count;
    bucket.onlineCount += p.online_count;
    bucket.ordersCount += p.orders_count;
    bucket.totalSpend += p.total_spend;
    if (!p.is_centroid) {
      bucket.allCentroid = false;
    }

    for (const s of p.sample_customers) {
      if (bucket.samples.length >= 6) break;
      if (!bucket.seenSampleIds.has(s.id)) {
        bucket.seenSampleIds.add(s.id);
        bucket.samples.push(s);
      }
    }
  }

  return Array.from(buckets.entries()).map(([code, bucket]) => {
    const first = bucket.points[0];
    const groupCount = bucket.points.length;
    return {
      cluster_key: `country:${code}`,
      country_code: first.country_code,
      country_name: first.country_name,
      city: groupCount > 1 ? `${groupCount} şehir/konum` : first.city,
      region_name: groupCount === 1 ? first.region_name : "",
      lat: bucket.weightedLat / bucket.totalWeight,
      lon: bucket.weightedLon / bucket.totalWeight,
      customer_count: bucket.customerCount,
      today_count: bucket.todayCount,
      online_count: bucket.onlineCount,
      orders_count: bucket.ordersCount,
      total_spend: bucket.totalSpend,
      is_centroid: bucket.allCentroid,
      sample_customers: bucket.samples,
    };
  });
}

export default function CustomersWorldMap({
  points,
  selectedCountry,
  onFilterCountry,
  onSelectCustomerById,
}: CustomersWorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const hasFittedInitialRef = useRef(false);
  const [tileMode, setTileMode] = useState<TileMode>("osm");
  const [zoomLevel, setZoomLevel] = useState<number>(2);

  const filterCountryRef = useRef(onFilterCountry);
  const selectCustomerRef = useRef(onSelectCustomerById);

  useEffect(() => {
    filterCountryRef.current = onFilterCountry;
    selectCustomerRef.current = onSelectCustomerById;
  }, [onFilterCountry, onSelectCustomerById]);

  const visiblePoints = useMemo(() => {
    if (!selectedCountry || selectedCountry === "ALL" || selectedCountry === "UNKNOWN") {
      return points;
    }
    if (selectedCountry === "FOREIGN") {
      return points.filter((p) => p.country_code !== "TR");
    }
    return points.filter((p) => p.country_code.toUpperCase() === selectedCountry.toUpperCase());
  }, [points, selectedCountry]);

  const renderedPoints = useMemo(() => {
    const isSingleCountryFilter = /^[A-Za-z]{2}$/.test(selectedCountry.trim());
    if (zoomLevel >= 5 || isSingleCountryFilter) {
      return visiblePoints;
    }
    return clusterPointsByCountry(visiblePoints);
  }, [visiblePoints, zoomLevel, selectedCountry]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [36.5, 22.0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> katılımcıları',
      maxZoom: 18,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    map.on("zoomend", () => {
      setZoomLevel(map.getZoom());
    });

    mapRef.current = map;
    markersLayerRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      hasFittedInitialRef.current = false;
    };
  }, []);

  useEffect(() => {
    const pane = mapRef.current?.getPane("tilePane");
    if (!pane) return;
    pane.style.filter =
      tileMode === "light" ? "grayscale(0.88) brightness(1.06) contrast(0.92)" : "";
  }, [tileMode]);

  const handleFitBounds = () => {
    const map = mapRef.current;
    if (!map || visiblePoints.length === 0) return;
    const latLngs: [number, number][] = visiblePoints.map((p) => [p.lat, p.lon]);
    if (latLngs.length === 1) {
      map.setView(latLngs[0], 6, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 6, animate: true });
  };

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    renderedPoints.forEach((p) => {
      const size = Math.min(48, Math.max(28, Math.round(24 + Math.sqrt(p.customer_count) * 6)));
      const hasFreshActivity = p.today_count > 0 || p.online_count > 0;
      const bgColor = hasFreshActivity
        ? "linear-gradient(135deg,#059669,#10b981)"
        : "linear-gradient(135deg,#4338ca,#6366f1)";
      const ringColor = hasFreshActivity
        ? "0 0 0 5px rgba(16,185,129,0.22)"
        : "0 0 0 4px rgba(79,70,229,0.18)";

      const icon = L.divIcon({
        className: "mv-osm-cluster-pin",
        html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bgColor};color:#ffffff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:${ringColor},0 6px 14px rgba(15,23,42,0.25);font-variant-numeric:tabular-nums;">${p.customer_count}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2)],
      });

      const marker = L.marker([p.lat, p.lon], { icon });
      marker.bindTooltip(
        `${escapeHtml(p.city ? `${p.city}, ` : "")}${escapeHtml(p.country_name || p.country_code)} • ${p.customer_count} müşteri`,
        { direction: "top", offset: [0, -Math.round(size / 2)] }
      );
      marker.bindPopup(buildMarkerPopupHtml(p), { maxWidth: 290 });

      marker.on("popupopen", (event) => {
        const popupEl = event.popup.getElement();
        if (!popupEl) return;

        popupEl.querySelectorAll<HTMLButtonElement>("[data-osm-country]").forEach((btn) => {
          btn.onclick = () => {
            const cc = btn.getAttribute("data-osm-country");
            if (cc) {
              filterCountryRef.current(cc);
            }
          };
        });

        popupEl.querySelectorAll<HTMLButtonElement>("[data-osm-customer]").forEach((btn) => {
          btn.onclick = () => {
            const customerId = btn.getAttribute("data-osm-customer");
            if (customerId) {
              selectCustomerRef.current(customerId);
            }
          };
        });
      });

      marker.addTo(layer);
    });

    if (visiblePoints.length > 0 && !hasFittedInitialRef.current) {
      hasFittedInitialRef.current = true;
      const latLngs: [number, number][] = visiblePoints.map((p) => [p.lat, p.lon]);
      if (latLngs.length === 1) {
        map.setView(latLngs[0], 5);
      } else {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36], maxZoom: 6 });
      }
    }
  }, [renderedPoints, visiblePoints]);

  return (
    <div className="isolate relative z-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
      <div
        ref={containerRef}
        className="w-full h-[380px] sm:h-[420px]"
        aria-label="Müşteri coğrafi dağılım OpenStreetMap haritası"
      />

      <div className="pointer-events-none absolute top-3 right-3 z-[400] flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTileMode((prev) => (prev === "osm" ? "light" : "osm"))}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/95 backdrop-blur border border-zinc-200 shadow-sm text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
          title="Harita renk modunu değiştir"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          {tileMode === "osm" ? "Renkli OSM" : "Sade OSM"}
        </button>

        {visiblePoints.length > 0 && (
          <button
            type="button"
            onClick={handleFitBounds}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/95 backdrop-blur border border-zinc-200 shadow-sm text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
            title="Tüm müşteri noktalarını kadraja sığdır"
          >
            <Compass className="w-3.5 h-3.5 text-zinc-600" />
            Kadraja Sığdır
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur border border-zinc-200 shadow-sm text-[11px] text-zinc-700">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
          Bugün kayıt / aktif
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
          Kayıtlı küme
        </span>
      </div>

      {visiblePoints.length === 0 && (
        <div className="absolute inset-0 z-[401] flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] text-center p-6">
          <MapPin className="w-8 h-8 text-zinc-400 mb-2" />
          <p className="text-sm font-semibold text-zinc-800">
            Seçili filtre için harita koordinatı bulunamadı
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            IP ve telefon alan kodu üzerinden eksik konumları çözümlemek için yukarıdaki &ldquo;Konumları Şimdi Çözümle&rdquo; butonunu kullanabilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
}
