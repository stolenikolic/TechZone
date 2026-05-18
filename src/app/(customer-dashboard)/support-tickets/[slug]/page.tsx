import { Metadata } from "next";
import { dynamicShopMetadata } from "lib/site-metadata";
import { notFound } from "next/navigation";
import { TicketDetailsPageView } from "pages-sections/customer-dashboard/support-tickets/page-view";
// API FUNCTIONS
import api from "utils/__api__/ticket";
// CUSTOM DATA MODEL
import { SlugParams } from "models/Common";

export async function generateMetadata({ params }: SlugParams): Promise<Metadata> {
  const { slug } = await params;
  const ticket = await api.getTicket(slug);

  return dynamicShopMetadata(ticket.title);
}

export default async function SupportTicketDetails({ params }: SlugParams) {
  const { slug } = await params;
  const ticket = await api.getTicket(slug);

  if (!ticket) notFound();

  return <TicketDetailsPageView ticket={ticket} />;
}
