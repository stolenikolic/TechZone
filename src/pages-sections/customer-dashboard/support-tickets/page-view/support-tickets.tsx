import { Fragment } from "react";
// CUSTOM COMPONENTS
import Headset from "icons/Headset";
import TicketCard from "../ticket-card";
import Pagination from "../../pagination";
import DashboardHeader from "../../dashboard-header";
// CUSTOM DATA MODEL
import Ticket from "models/Ticket.model";

// =============================================
interface Props {
  tickets: Ticket[];
  totalPages: number;
}
// =============================================

export function TicketsPageView({ tickets, totalPages }: Props) {
  return (
    <Fragment>
      <DashboardHeader title="Support Ticket" Icon={Headset} />

      {tickets.map((item) => (
        <TicketCard ticket={item} key={item.id} />
      ))}

      <Pagination count={totalPages} />
    </Fragment>
  );
}
