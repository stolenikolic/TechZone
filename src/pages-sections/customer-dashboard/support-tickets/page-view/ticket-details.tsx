import { Fragment } from "react";
// LOCAL CUSTOM COMPONENTS
import MessageForm from "../message-form";
import ConversationCard from "../conversation-card";
import DashboardHeader from "../../dashboard-header";
// CUSTOM DATA MODEL
import Ticket from "models/Ticket.model";

// ==========================================================
type Props = { ticket: Ticket };
// ==========================================================

export function TicketDetailsPageView({ ticket }: Props) {
  return (
    <Fragment>
      <DashboardHeader title="Support Ticket" href="/support-tickets" />
      {ticket.conversation?.map((item, ind) => (
        <ConversationCard message={item} key={ind} />
      ))}
      <MessageForm />
    </Fragment>
  );
}
