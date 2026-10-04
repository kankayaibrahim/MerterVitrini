export const PGLITE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS catalog_products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    brand TEXT NOT NULL,
    category_slug TEXT NOT NULL,
    gender TEXT,
    season TEXT,
    fabric TEXT,
    price NUMERIC NOT NULL,
    discounted_price NUMERIC,
    currency TEXT NOT NULL DEFAULT 'TRY',
    stock INT NOT NULL DEFAULT 0,
    series_ratio TEXT,
    moq INT NOT NULL DEFAULT 1,
    cover_image TEXT,
    colors TEXT,
    sizes TEXT,
    raw_json TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS raw_json TEXT;

CREATE INDEX IF NOT EXISTS idx_cat_products_cat ON catalog_products (category_slug);
CREATE INDEX IF NOT EXISTS idx_cat_products_brand ON catalog_products (brand);
CREATE INDEX IF NOT EXISTS idx_cat_products_price ON catalog_products (price);
CREATE INDEX IF NOT EXISTS idx_cat_products_stock ON catalog_products (stock);
CREATE INDEX IF NOT EXISTS idx_cat_products_gender ON catalog_products (gender);
CREATE INDEX IF NOT EXISTS idx_cat_products_season ON catalog_products (season);

CREATE TABLE IF NOT EXISTS local_cart (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    cover_image TEXT,
    price NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TRY',
    packages_qty INT NOT NULL DEFAULT 1,
    pieces_per_package INT NOT NULL DEFAULT 1,
    total_pieces INT NOT NULL DEFAULT 1,
    series_ratio TEXT,
    selected_color TEXT,
    selected_size TEXT,
    notes TEXT,
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
`;

export interface LocalCatalogProduct {
  id: string;
  title: string;
  slug: string;
  brand: string;
  category_slug: string;
  gender?: string | null;
  season?: string | null;
  fabric?: string | null;
  price: number;
  discounted_price?: number | null;
  currency: string;
  stock: number;
  series_ratio?: string | null;
  moq: number;
  cover_image?: string | null;
  colors?: string | null; // JSON string array
  sizes?: string | null;  // JSON string array
  raw_json?: string | null;
  updated_at?: string;
}

export interface LocalCartItem {
  id: string;
  product_id: string;
  title: string;
  slug: string;
  cover_image?: string | null;
  price: number;
  currency: string;
  packages_qty: number;
  pieces_per_package: number;
  total_pieces: number;
  series_ratio?: string | null;
  selected_color?: string | null;
  selected_size?: string | null;
  notes?: string | null;
  added_at?: string;
}
