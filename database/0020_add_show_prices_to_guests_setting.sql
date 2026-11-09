-- Migration 0020: Add show_prices_to_guests flag to catalog.settings
-- Allows administrators to control from the Admin Panel whether unauthenticated
-- storefront and mobile visitors can view wholesale prices or must log in.

ALTER TABLE catalog.settings
    ADD COLUMN IF NOT EXISTS show_prices_to_guests BOOLEAN NOT NULL DEFAULT false;

