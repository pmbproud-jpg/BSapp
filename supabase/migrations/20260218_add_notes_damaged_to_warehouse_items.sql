-- Add notes and is_damaged columns to warehouse_items
ALTER TABLE warehouse_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE warehouse_items ADD COLUMN IF NOT EXISTS is_damaged boolean DEFAULT false;
