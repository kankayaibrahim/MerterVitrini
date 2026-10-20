-- 0016_add_supplier_district_and_seed_turkey_cities.sql
-- Add district column to supplier applications and index for country_cities

ALTER TABLE catalog.supplier_applications 
ADD COLUMN IF NOT EXISTS district character varying(100);

CREATE INDEX IF NOT EXISTS idx_country_cities_state_id 
ON catalog.country_cities(state_id);

CREATE INDEX IF NOT EXISTS idx_supplier_applications_city_district 
ON catalog.supplier_applications(city, district);
