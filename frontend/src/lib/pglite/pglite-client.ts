import { PGliteWorker } from "@electric-sql/pglite/worker";
import { LocalCatalogProduct, LocalCartItem } from "./pglite-schema";
import { Product } from "@/types/store";

let pgliteInstance: PGliteWorker | null = null;
let initPromise: Promise<PGliteWorker | null> | null = null;

/**
 * Returns the singleton PGliteWorker client running inside a Web Worker.
 * Safe for SSR: returns null if executed in a server environment.
 */
export async function getPGliteClient(): Promise<PGliteWorker | null> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  if (pgliteInstance) {
    return pgliteInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const worker = new Worker(new URL("./pglite.worker.ts", import.meta.url), {
        type: "module",
      });
      const pg = new PGliteWorker(worker);
      await pg.waitReady;
      pgliteInstance = pg;
      return pg;
    } catch (err) {
      console.warn("[PGLITE] Web Worker initialization failed, falling back to network API:", err);
      return null;
    }
  })();

  return initPromise;
}

export interface CatalogFilterQuery {
  categorySlug?: string;
  brands?: string[];
  genders?: string[];
  seasons?: string[];
  fabrics?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  searchQuery?: string;
  sortBy?: "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc";
  limit?: number;
  offset?: number;
}

export interface CatalogQueryResult {
  products: LocalCatalogProduct[];
  totalCount: number;
}

/**
 * Executes high-performance faceted catalog filtering directly in browser WASM PostgreSQL
 */
export async function queryLocalCatalog(filters: CatalogFilterQuery): Promise<CatalogQueryResult | null> {
  const pg = await getPGliteClient();
  if (!pg) return null;

  try {
    const whereClauses: string[] = ["1=1"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.categorySlug) {
      whereClauses.push(`category_slug = $${paramIdx++}`);
      params.push(filters.categorySlug);
    }

    if (filters.brands && filters.brands.length > 0) {
      whereClauses.push(`brand = ANY($${paramIdx++})`);
      params.push(filters.brands);
    }

    if (filters.genders && filters.genders.length > 0) {
      whereClauses.push(`gender = ANY($${paramIdx++})`);
      params.push(filters.genders);
    }

    if (filters.seasons && filters.seasons.length > 0) {
      whereClauses.push(`season = ANY($${paramIdx++})`);
      params.push(filters.seasons);
    }

    if (filters.fabrics && filters.fabrics.length > 0) {
      whereClauses.push(`fabric = ANY($${paramIdx++})`);
      params.push(filters.fabrics);
    }

    if (filters.minPrice !== undefined && filters.minPrice > 0) {
      whereClauses.push(`price >= $${paramIdx++}`);
      params.push(filters.minPrice);
    }

    if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
      whereClauses.push(`price <= $${paramIdx++}`);
      params.push(filters.maxPrice);
    }

    if (filters.inStockOnly) {
      whereClauses.push("stock > 0");
    }

    if (filters.searchQuery && filters.searchQuery.trim() !== "") {
      whereClauses.push(`(title ILIKE $${paramIdx} OR brand ILIKE $${paramIdx})`);
      params.push(`%${filters.searchQuery.trim()}%`);
      paramIdx++;
    }

    const whereSql = whereClauses.join(" AND ");

    // Count query
    const countRes = await pg.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM catalog_products WHERE ${whereSql}`,
      params
    );
    const totalCount = parseInt(countRes.rows[0]?.count || "0", 10);

    // Sorting
    let orderSql = "ORDER BY updated_at DESC";
    if (filters.sortBy === "price_asc") {
      orderSql = "ORDER BY price ASC";
    } else if (filters.sortBy === "price_desc") {
      orderSql = "ORDER BY price DESC";
    } else if (filters.sortBy === "name_asc") {
      orderSql = "ORDER BY title ASC";
    } else if (filters.sortBy === "name_desc") {
      orderSql = "ORDER BY title DESC";
    }

    const limit = filters.limit || 48;
    const offset = filters.offset || 0;

    const dataQuery = `
      SELECT * FROM catalog_products 
      WHERE ${whereSql} 
      ${orderSql} 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const dataRes = await pg.query<LocalCatalogProduct>(dataQuery, params);
    return {
      products: dataRes.rows,
      totalCount,
    };
  } catch (err) {
    console.warn("[PGLITE] Local catalog query error:", err);
    return null;
  }
}

/**
 * Upserts products into PGlite IndexedDB cache in bulk
 */
export async function batchUpsertLocalProducts(products: LocalCatalogProduct[]): Promise<boolean> {
  const pg = await getPGliteClient();
  if (!pg || products.length === 0) return false;

  try {
    const upsertSql = `
      INSERT INTO catalog_products (
        id, title, slug, brand, category_slug, gender, season, fabric,
        price, discounted_price, currency, stock, series_ratio, moq,
        cover_image, colors, sizes, raw_json, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        brand = EXCLUDED.brand,
        category_slug = EXCLUDED.category_slug,
        gender = EXCLUDED.gender,
        season = EXCLUDED.season,
        fabric = EXCLUDED.fabric,
        price = EXCLUDED.price,
        discounted_price = EXCLUDED.discounted_price,
        currency = EXCLUDED.currency,
        stock = EXCLUDED.stock,
        series_ratio = EXCLUDED.series_ratio,
        moq = EXCLUDED.moq,
        cover_image = EXCLUDED.cover_image,
        colors = EXCLUDED.colors,
        sizes = EXCLUDED.sizes,
        raw_json = EXCLUDED.raw_json,
        updated_at = CURRENT_TIMESTAMP
    `;

    for (const p of products) {
      await pg.query(upsertSql, [
        p.id,
        p.title,
        p.slug,
        p.brand,
        p.category_slug,
        p.gender || null,
        p.season || null,
        p.fabric || null,
        p.price,
        p.discounted_price || null,
        p.currency || "TRY",
        p.stock || 0,
        p.series_ratio || null,
        p.moq || 1,
        p.cover_image || null,
        p.colors || null,
        p.sizes || null,
        p.raw_json || null,
      ]);
    }

    return true;
  } catch (err) {
    console.warn("[PGLITE] Batch upsert products failed:", err);
    return false;
  }
}

/**
 * Local B2B Cart operations backed by PGlite SQL
 */
export async function getLocalCartItems(): Promise<LocalCartItem[]> {
  const pg = await getPGliteClient();
  if (!pg) return [];

  try {
    const res = await pg.query<LocalCartItem>("SELECT * FROM local_cart ORDER BY added_at DESC");
    return res.rows;
  } catch (err) {
    console.warn("[PGLITE] Failed to load local cart:", err);
    return [];
  }
}

export async function addOrUpdateLocalCartItem(item: LocalCartItem): Promise<boolean> {
  const pg = await getPGliteClient();
  if (!pg) return false;

  try {
    const sql = `
      INSERT INTO local_cart (
        id, product_id, title, slug, cover_image, price, currency,
        packages_qty, pieces_per_package, total_pieces, series_ratio,
        selected_color, selected_size, notes, added_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        packages_qty = EXCLUDED.packages_qty,
        total_pieces = EXCLUDED.total_pieces,
        notes = EXCLUDED.notes
    `;

    await pg.query(sql, [
      item.id,
      item.product_id,
      item.title,
      item.slug,
      item.cover_image || null,
      item.price,
      item.currency,
      item.packages_qty,
      item.pieces_per_package,
      item.total_pieces,
      item.series_ratio || null,
      item.selected_color || null,
      item.selected_size || null,
      item.notes || null,
    ]);

    return true;
  } catch (err) {
    console.warn("[PGLITE] Failed to save cart item:", err);
    return false;
  }
}

export async function removeLocalCartItem(id: string): Promise<boolean> {
  const pg = await getPGliteClient();
  if (!pg) return false;

  try {
    await pg.query("DELETE FROM local_cart WHERE id = $1", [id]);
    return true;
  } catch (err) {
    console.warn("[PGLITE] Failed to remove cart item:", err);
    return false;
  }
}

export async function clearLocalCart(): Promise<boolean> {
  const pg = await getPGliteClient();
  if (!pg) return false;

  try {
    await pg.query("DELETE FROM local_cart");
    return true;
  } catch (err) {
    console.warn("[PGLITE] Failed to clear local cart:", err);
    return false;
  }
}

/**
 * Returns total number of products stored in local PGlite IndexedDB
 */
export async function getLocalProductCount(): Promise<number> {
  const pg = await getPGliteClient();
  if (!pg) return 0;
  try {
    const res = await pg.query<{ count: string }>("SELECT COUNT(*)::text as count FROM catalog_products");
    return parseInt(res.rows[0]?.count || "0", 10);
  } catch {
    return 0;
  }
}

/**
 * Gets the last delta sync timestamp stored in sync_meta
 */
export async function getLastSyncTime(): Promise<string | null> {
  const pg = await getPGliteClient();
  if (!pg) return null;
  try {
    const res = await pg.query<{ value: string }>("SELECT value FROM sync_meta WHERE key = 'catalog_last_sync'");
    return res.rows[0]?.value || null;
  } catch {
    return null;
  }
}

/**
 * Stores the last delta sync timestamp in sync_meta
 */
export async function setLastSyncTime(timestamp: string): Promise<boolean> {
  const pg = await getPGliteClient();
  if (!pg) return false;
  try {
    await pg.query(
      `INSERT INTO sync_meta (key, value, updated_at) 
       VALUES ('catalog_last_sync', $1, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [timestamp]
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Maps a standard Product to a LocalCatalogProduct for PGlite storage
 */
export function mapProductToLocal(p: Product): LocalCatalogProduct {
  const coverImage = p.images?.find((img) => img.is_cover)?.image_url || p.images?.[0]?.image_url || null;
  const colors = p.color_variants ? JSON.stringify(p.color_variants.map(c => c.color)) : null;
  const sizes = p.variants ? JSON.stringify(p.variants.map(v => v.size)) : null;

  return {
    id: p.id,
    title: p.title,
    slug: p.slug || p.id,
    brand: p.brand_name || p.brand_id || "",
    category_slug: p.category_id || "",
    gender: p.gender || null,
    season: p.season || null,
    fabric: p.kumas_fabric || null,
    price: p.price,
    discounted_price: p.discounted_price || null,
    currency: p.currency || "TRY",
    stock: p.stock || 0,
    series_ratio: p.series_ratio || null,
    moq: p.minimum_order_quantity || 1,
    cover_image: coverImage,
    colors,
    sizes,
    raw_json: JSON.stringify(p),
  };
}

/**
 * Maps a LocalCatalogProduct back to a typed Product for storefront UI rendering
 */
export function mapLocalToProduct(lp: LocalCatalogProduct): Product {
  if (lp.raw_json) {
    try {
      return JSON.parse(lp.raw_json) as Product;
    } catch {
      // fallback if JSON parse fails
    }
  }

  return {
    id: lp.id,
    title: lp.title,
    slug: lp.slug,
    brand_id: lp.brand,
    brand_name: lp.brand,
    category_id: lp.category_slug,
    gender: lp.gender || undefined,
    season: lp.season || undefined,
    kumas_fabric: lp.fabric || undefined,
    price: Number(lp.price),
    discounted_price: lp.discounted_price ? Number(lp.discounted_price) : Number(lp.price),
    currency: lp.currency,
    stock: lp.stock,
    series_ratio: lp.series_ratio || undefined,
    minimum_order_quantity: lp.moq,
    images: lp.cover_image ? [{ id: "cover", image_url: lp.cover_image, is_cover: true }] : [],
  };
}
