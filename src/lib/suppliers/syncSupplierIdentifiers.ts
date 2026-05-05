import { createSupabaseServiceClient } from "utils/supabase";

type SupabaseClient = ReturnType<typeof createSupabaseServiceClient>;

type SupplierIdentifiers = { mpn: string | null; ean: string | null };
type MasterIdentifiers = { mpn: string | null; ean: string | null };

function normalized(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text.toLowerCase() : null;
}

export function getIdentifierSyncUpdate(
  supplier: SupplierIdentifiers,
  master: MasterIdentifiers
) {
  const update: Record<string, string> = {};
  const synced: string[] = [];
  const conflicts: string[] = [];

  if (!supplier.mpn && master.mpn) {
    update.mpn = master.mpn;
    synced.push("mpn");
  } else if (supplier.mpn && master.mpn && normalized(supplier.mpn) !== normalized(master.mpn)) {
    conflicts.push("mpn");
  }

  if (!supplier.ean && master.ean) {
    update.ean = master.ean;
    synced.push("ean");
  } else if (supplier.ean && master.ean && normalized(supplier.ean) !== normalized(master.ean)) {
    conflicts.push("ean");
  }

  return { update, synced, conflicts };
}

export async function syncMissingIdentifiersFromMaster(
  supabase: SupabaseClient,
  args: {
    supplierProductId: string;
    productId: string;
    supplier?: SupplierIdentifiers;
    master?: MasterIdentifiers;
  }
) {
  let supplierResolved = args.supplier ?? null;
  if (!supplierResolved) {
    const { data, error } = await supabase
        .from("supplier_products")
        .select("mpn, ean")
        .eq("id", args.supplierProductId)
        .maybeSingle();
    if (error) throw new Error(`supplier_products identifiers lookup failed: ${error.message}`);
    supplierResolved = data as SupplierIdentifiers | null;
  }

  let masterResolved = args.master ?? null;
  if (!masterResolved) {
    const { data, error } = await supabase
        .from("products")
        .select("mpn, ean")
        .eq("id", args.productId)
        .maybeSingle();
    if (error) throw new Error(`products identifiers lookup failed: ${error.message}`);
    masterResolved = data as MasterIdentifiers | null;
  }

  if (!supplierResolved || !masterResolved) {
    return { update: {}, synced: [], conflicts: [] };
  }

  const decision = getIdentifierSyncUpdate(supplierResolved, masterResolved);
  if (Object.keys(decision.update).length > 0) {
    const { error } = await supabase
      .from("supplier_products")
      .update({ ...decision.update, updated_at: new Date().toISOString() })
      .eq("id", args.supplierProductId);
    if (error) throw new Error(`supplier_products identifiers sync failed: ${error.message}`);
  }

  return decision;
}
