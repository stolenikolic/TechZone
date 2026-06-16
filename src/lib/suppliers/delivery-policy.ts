import type { DeliveryPolicy } from "lib/product-offers";

const DEFAULT_POLICY: DeliveryPolicy = { type: "weekly", weekday: 1 };

export function parseDeliveryPolicyJson(value: unknown): DeliveryPolicy | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return parseDeliveryPolicyJson(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (o.type === "daily") return { type: "daily" };
  const weekday =
    typeof o.weekday === "number" && o.weekday >= 0 && o.weekday <= 6 ? Math.round(o.weekday) : 1;
  return { type: "weekly", weekday };
}

export function deliveryPolicyToJson(policy: DeliveryPolicy): Record<string, unknown> {
  if (policy.type === "daily") return { type: "daily" };
  return { type: "weekly", weekday: policy.weekday };
}

export function defaultDeliveryPolicyJson(): Record<string, unknown> {
  return deliveryPolicyToJson(DEFAULT_POLICY);
}
