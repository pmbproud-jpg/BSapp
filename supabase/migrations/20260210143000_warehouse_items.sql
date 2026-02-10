-- Warehouse items table (Magazyn)
-- Columns A-P from Excel import
CREATE TABLE IF NOT EXISTS public.warehouse_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  iv_pds TEXT,                       -- A: IV / PDS
  menge TEXT,                        -- B: Menge (Ilość)
  beschreibung TEXT,                 -- C: Beschreibung (Opis)
  serial_nummer TEXT,                -- D: Serial Nummer (Numer seryjny)
  akku_serial_nummer TEXT,           -- E: Akku Serial Nummer (Numer seryjny akumulatora)
  ladegeraet_sn TEXT,                -- F: Ladegerät S.N (Numer seryjny ładowarki)
  status TEXT,                       -- G: Status
  datum_abgeben TEXT,                -- H: Datum Abgeben (Data wydania / przekazania)
  baustelle TEXT,                    -- I: Baustelle (Budowa / plac budowy)
  hersteller TEXT,                   -- J: Hersteller (Producent)
  inventar TEXT,                     -- K: Inventar (Inwentarz / majątek)
  aufmerksamkeit TEXT,               -- L: Aufmerksamkeit (Uwaga)
  art_nr TEXT,                       -- M: Art-Nr (Nr artykułu)
  datum_inventur TEXT,               -- N: Datum Inventur (Data inwentaryzacji)
  kategorie TEXT,                    -- O: Kategorie (Kategoria)
  wartungstermine TEXT,              -- P: Wartungstermine 2026 (Terminy konserwacji 2026)
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_items_company ON public.warehouse_items(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_beschreibung ON public.warehouse_items(beschreibung);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_serial ON public.warehouse_items(serial_nummer);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_baustelle ON public.warehouse_items(baustelle);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_kategorie ON public.warehouse_items(kategorie);

-- RLS
ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read warehouse items"
  ON public.warehouse_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert warehouse items"
  ON public.warehouse_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update warehouse items"
  ON public.warehouse_items FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete warehouse items"
  ON public.warehouse_items FOR DELETE
  USING (auth.role() = 'authenticated');
