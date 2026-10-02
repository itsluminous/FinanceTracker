-- ============================================================================
-- Migration: add Bonds (low risk) and US Stocks (high/medium risk) columns
-- ============================================================================
-- Run this in the Supabase SQL Editor on an EXISTING database that was created
-- with an older database-setup.sql. Fresh installs already include these
-- columns via sql/database-setup.sql and do NOT need this script.
--
-- Postgres cannot ALTER the expression of a GENERATED column, so the three
-- total_* columns are dropped and recreated. They are STORED generated
-- columns, so they are recomputed from the base columns and no data is lost.
-- Existing rows get 0 for the new columns, which leaves their totals unchanged.
-- ============================================================================

BEGIN;

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS us_stocks DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonds DECIMAL(15, 2) DEFAULT 0;

UPDATE financial_entries SET us_stocks = 0 WHERE us_stocks IS NULL;
UPDATE financial_entries SET bonds = 0 WHERE bonds IS NULL;

ALTER TABLE financial_entries
  DROP COLUMN IF EXISTS total_high_medium_risk,
  DROP COLUMN IF EXISTS total_low_risk,
  DROP COLUMN IF EXISTS total_assets;

ALTER TABLE financial_entries
  ADD COLUMN total_high_medium_risk DECIMAL(15, 2) GENERATED ALWAYS AS (
    direct_equity + esops + equity_pms + ulip + real_estate +
    real_estate_funds + private_equity + equity_mutual_funds +
    structured_products_equity + us_stocks
  ) STORED,
  ADD COLUMN total_low_risk DECIMAL(15, 2) GENERATED ALWAYS AS (
    bank_balance + debt_mutual_funds + endowment_plans + fixed_deposits +
    nps + epf + ppf + structured_products_debt + gold_etfs_funds + bonds
  ) STORED,
  ADD COLUMN total_assets DECIMAL(15, 2) GENERATED ALWAYS AS (
    direct_equity + esops + equity_pms + ulip + real_estate +
    real_estate_funds + private_equity + equity_mutual_funds +
    structured_products_equity + us_stocks +
    bank_balance + debt_mutual_funds + endowment_plans + fixed_deposits +
    nps + epf + ppf + structured_products_debt + gold_etfs_funds + bonds
  ) STORED;

COMMIT;
