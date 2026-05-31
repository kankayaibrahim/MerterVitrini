// =========================================================================
// STOREFRONT B2B CORE UTILS - MERTER VİTRİNİ
// =========================================================================

// Safe HTML Escaping Helper to prevent XSS (Cross-Site Scripting)
window.escapeHtml = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Calculate units per package from series ratio: e.g., "2-2-2" -> 6 units
window.getUnitsFromSeriesRatio = function(seriesRatio) {
    if (!seriesRatio) return 1;
    const parts = seriesRatio.split(/[- ,]/);
    let total = 0;
    parts.forEach(p => {
        const val = parseInt(p);
        if (!isNaN(val)) total += val;
    });
    return total > 0 ? total : 1;
};

// Base Fetch Function interfacing with Port 8081 Go service
window.apiFetch = async function(endpoint) {
    try {
        const response = await fetch(`/api/v1/store${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error("API Fetch failed for endpoint", endpoint, e);
        return null;
    }
};
