import { NextResponse } from "next/server";
import type Service from "models/Service.model";

const SERVICE_LIST: Service[] = [
  { id: "1", icon: "Truck", title: "Fast Delivery", description: "Start from $10" },
  { id: "2", icon: "MoneyGuarantee", title: "Money Guarantee", description: "7 Days Back" },
  { id: "3", icon: "AlarmClock", title: "365 Days", description: "For free return" },
  { id: "4", icon: "Payment", title: "Payment", description: "Secure system" }
];

export async function GET() {
  return NextResponse.json(SERVICE_LIST);
}
