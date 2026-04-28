import { cache } from "react";
import axios from "utils/axiosInstance";
// CUSTOM DATA MODEL
import Ticket from "models/Ticket.model";
import { SlugParams } from "models/Common";

export const getTicketList = cache(async (page = 1) => {
  const PAGE_SIZE = 5;
  const PAGE_NO = page - 1;

  const { data: tickets } = await axios.get<Ticket[]>("/api/tickets");
  const totalPages = Math.ceil(tickets.length / PAGE_SIZE);

  // const currentTickets = tickets.slice(PAGE_NO * PAGE_SIZE, (PAGE_NO + 1) * PAGE_SIZE);
  const response = { tickets: tickets, totalTickets: tickets.length, totalPages };
  return response;
});

export const getTicket = cache(async (slug: string) => {
  const response = await axios.get<Ticket>("/api/tickets/single", { params: { slug } });
  return response.data;
});

export const getSlugs = cache(async () => {
  const response = await axios.get<SlugParams[]>("/api/tickets/slugs");
  return response.data;
});

export default { getTicketList, getTicket, getSlugs };
