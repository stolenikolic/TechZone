import { adminPageMetadata } from "lib/site-metadata";
import { notFound } from "next/navigation";
import { SupportTicketsPageView } from "pages-sections/vendor-dashboard/support-tickets/page-view";
// API FUNCTIONS
import api from "utils/__api__/ticket";

export const metadata = adminPageMetadata("Tiketi podrške");

export default async function SupportTickets() {
  const { tickets } = await api.getTicketList();
  if (!tickets || tickets.length === 0) notFound();

  return <SupportTicketsPageView tickets={tickets} />;
}
