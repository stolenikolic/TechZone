import Link from "next/link";
import { format } from "date-fns/format";
// MUI
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import East from "@mui/icons-material/East";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
// CUSTOM DATA MODEL
import Ticket from "models/Ticket.model";

// ==============================================================
type Props = { ticket: Ticket };
// ==============================================================

export default function TicketCard({ ticket }: Props) {
  const { id, slug, title, type, status, date, category } = ticket;

  return (
    <Link href={`/support-tickets/${slug}`} key={id}>
      <Card
        elevation={0}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingInline: 2.5,
          paddingBlock: 2,
          marginBottom: 2,
          border: "1px solid",
          borderColor: "grey.100"
        }}
      >
        <div>
          <Typography variant="body1" fontWeight={500} sx={{ mb: 1.5 }}>
            {title}
          </Typography>

          <FlexBox alignItems="center" flexWrap="wrap" gap={1}>
            <Chip label={type} size="small" color={type === "Urgent" ? "error" : "info"} />
            <Chip label={status} size="small" color="success" />

            <Typography variant="body1" className="pre" color="text.secondary">
              {format(new Date(date), "MMM dd, yyyy")}
            </Typography>

            <Typography variant="body1" color="text.disabled">
              {category}
            </Typography>
          </FlexBox>
        </div>

        <IconButton>
          <East
            fontSize="small"
            sx={{
              color: "grey.500",
              ":dir(rtl)": {
                transform: "rotate(180deg)"
              }
            }}
          />
        </IconButton>
      </Card>
    </Link>
  );
}
