/*
  # Add unit_price_max to proposal_line_items

  ## Summary
  Adds optional `unit_price_max` column to `proposal_line_items` to support
  price range line items (e.g., "$500 - $1,500" per milestone or phase).

  ## Changes
  - `proposal_line_items`: adds `unit_price_max` (nullable numeric, default null)
    - When null: item has a fixed price (unit_price)
    - When set: item is a price range from unit_price (min) to unit_price_max (max)

  ## Display Rules
  - Table list view: show max of range (unit_price_max) or fixed price (unit_price)
  - Detail pricing tab: show each item with its range or fixed price
  - Total: computed as sum of max prices for range items, or fixed prices
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_line_items' AND column_name = 'unit_price_max'
  ) THEN
    ALTER TABLE proposal_line_items ADD COLUMN unit_price_max numeric DEFAULT NULL;
  END IF;
END $$;
