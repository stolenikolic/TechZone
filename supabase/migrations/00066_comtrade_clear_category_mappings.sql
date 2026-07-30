-- 00066_comtrade_clear_category_mappings.sql
-- ComTrade: jasni productGroupID → interna kategorija (offer-only filter za import).
-- Ne dira products.category_id; UNIQUE(supplier_id, internal_category_id) → max 1 CT key po internoj.

INSERT INTO public.supplier_categories (
  supplier_id,
  internal_category_id,
  supplier_category_key,
  listing_url,
  is_active,
  sort_order
)
VALUES
  -- PC komponente
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '1210d55e-8521-4089-b419-d330d42f4bf2', 'VGA', NULL, true, 20),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '3fbbbd9d-0f06-4e29-9bf4-c9e6566a359c', 'MEMORIJE', NULL, true, 30),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '660c7768-4a5b-47bb-893b-55adc554cd7b', 'SSD', NULL, true, 40),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'c82fb741-d161-4c73-91fc-1cc6fad2123d', 'KUCISTA', NULL, true, 50),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '1b3db30c-c833-49f4-bc7a-f5155b2d319f', 'NAPAJANJA', NULL, true, 60),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'b3ffb89b-132d-4020-87a3-53a6c0a39b74', 'OPTIKA', NULL, true, 70),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'c409d781-f110-4096-8083-546a54fb457b', 'SOUNDCARD', NULL, true, 80),
  -- Periferija
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'b3aed679-69be-435c-89a9-ed84d13e23be', 'MISEVI', NULL, true, 90),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '37539c70-e232-4200-bbdc-5ff900ced99d', 'TASTATURE', NULL, true, 100),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '405b0059-fa4b-4c01-9746-62bb524a8490', 'MISPODLOGA', NULL, true, 110),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '8ef124cf-d1c9-486f-b49e-e645a142db82', 'MONITORI', NULL, true, 120),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '7f6d1ef7-eb55-4159-900c-00f2df15fb12', 'SLUSALICE', NULL, true, 130),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'a568bff0-6aff-4af3-b4f4-19c50a9d0fc5', 'ZVUCNICI', NULL, true, 140),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'b2e56706-13b7-4b52-a309-1a72866f4328', 'GAMSTOLICA', NULL, true, 150),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'fc9aab68-0a88-432e-870c-1509e366e824', 'SKENERI', NULL, true, 160),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '248478ef-a4f0-41d6-a01a-146c707b69e2', 'PRINTMFPML', NULL, true, 170),
  -- TV / projektori
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'df0e6cc3-2254-4b33-91b5-fed6985fce95', 'TV', NULL, true, 180),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '104d8d9e-b1e6-4267-8798-019ba1c39be1', 'PROJEKTORI', NULL, true, 190),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'aa55e1d5-1d2c-4d07-a6f6-33ec5a07836e', 'SETTOPBOX', NULL, true, 200),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '46b01e4b-484b-42ab-9cfc-be1d2e5d3ce3', 'DISPLAY', NULL, true, 210),
  -- Foto / video / dronovi
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '6ec23618-dfa1-470e-b92a-a25ae75c3460', 'DIGITCAM', NULL, true, 220),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'bf4e6a4c-2201-4664-a691-238cc0dae9cb', 'DIGITPHOTO', NULL, true, 230),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'c17cdafa-15d8-45ec-bdbe-ed57d1eee745', 'DRONES', NULL, true, 240),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '1acae6f1-ab38-4f6c-b1d7-c4d47acf9750', 'DRONOPCIJE', NULL, true, 250),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'b51c0536-dae4-4667-9cf5-3e4d45494a68', 'GIMBALSP', NULL, true, 260),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '3fbfd442-fe5d-4437-ac5d-619dfddf74db', 'PHOTOVIDAC', NULL, true, 270),
  -- Gaming
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '07f771d0-820d-415f-990b-fab5b9cc1594', 'KONZOLE', NULL, true, 280),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '03590a23-e9f9-4f35-9bed-cab70179432b', 'IGRICE', NULL, true, 290),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '0124ec37-8735-4ce5-9041-61efb8be52f9', 'JOYSTICK', NULL, true, 300),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'a1d98dca-8a6d-48ac-8df7-96d98fe6c2fd', 'GAMINGACC', NULL, true, 310),
  -- Telefoni / tableti
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '47c6eabb-0f64-4ada-99d1-5d5f06d8f83a', 'SMARTPHONE', NULL, true, 320),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '350cdf42-1872-4f54-8a49-c5c1899d1487', 'TELEFONMOB', NULL, true, 330),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'b056a8bc-2d63-4bea-9d47-7b16f0ade408', 'MOBILPCTAB', NULL, true, 340),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '00c412ca-7622-45c2-9a69-d8dc041f99fc', 'SMARTWATCH', NULL, true, 350),
  -- Mreža / sigurnost
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'df10f9e8-9fc5-436c-ac2d-70294e001aec', 'NETWORKRUT', NULL, true, 360),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '6fee2c07-5b0a-45a3-99a4-c57c189cd75f', 'NETWORKSWC', NULL, true, 370),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'eb8afe05-74b8-45fa-8c5a-7d409fad52cc', 'NETWORKACP', NULL, true, 380),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '1d0c8558-7181-414e-a9b6-c01dbd0aebaa', 'NETWORKCRD', NULL, true, 390),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', 'bfa4eeda-d762-4dee-bed0-03f371ee9172', 'NETWRKWRAD', NULL, true, 400),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '6d790079-7b33-40f6-a80c-7e56f3900874', 'NETWORKACC', NULL, true, 410),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '1a316ce3-d3d9-4bfa-8043-f88b6e795bb4', 'SECURITCAM', NULL, true, 420),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '5b326d7f-f1c3-400d-8680-ede85c103846', 'SERVERSACC', NULL, true, 430)
ON CONFLICT (supplier_id, internal_category_id) DO UPDATE
SET
  supplier_category_key = EXCLUDED.supplier_category_key,
  listing_url = EXCLUDED.listing_url,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
