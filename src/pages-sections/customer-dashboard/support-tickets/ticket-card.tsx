import Link from "next/link";
import { format } from "date-fns/format";
import { bs } from "date-fns/locale/bs";
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

const TYPE_LABEL: Record<string, string> = {
  Urgent: "Hitno",
  Normal: "Obično"
};

const STATUS_LABEL: Record<string, string> = {
  Open: "Otvoreno"
};

const CATEGORY_LABEL: Record<string, string> = {
  "Website Problem": "Problem sa sajtom",
  "UX Problem": "Problem sa korištenjem",
  "Payment Problem": "Problem sa plaćanjem"
};

const TITLE_LABEL: Record<string, string> = {
  "Product Broken. I need refund": "Proizvod je neispravan. Tražim povrat.",
  "When will my product arrive?": "Kada stiže proizvod?",
  "Payment method is not working": "Način plaćanja ne radi",
  "Do you accept prepaid card?": "Prihvatate li unaprijed plaćenu karticu?",
  "How much do I have to pay for...": "Koliko treba da platim za...",
  "Do you ship to Bangladesh?": "Šaljete li u Bangladeš?",
  "Where's My Stuff?": "Gdje je moja pošiljka?"
};

function labelOf(map: Record<string, string>, value: string) {
  return map[value] ?? value;
}

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
            {labelOf(TITLE_LABEL, title)}
          </Typography>

          <FlexBox alignItems="center" flexWrap="wrap" gap={1}>
            <Chip label={labelOf(TYPE_LABEL, type)} size="small" color={type === "Urgent" ? "error" : "info"} />
            <Chip label={labelOf(STATUS_LABEL, status)} size="small" color="success" />

            <Typography variant="body1" className="pre" color="text.secondary">
              {format(new Date(date), "d. MMM yyyy.", { locale: bs })}
            </Typography>

            <Typography variant="body1" color="text.disabled">
              {labelOf(CATEGORY_LABEL, category)}
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
