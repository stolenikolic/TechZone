import Image from "next/image";
// MUI
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import { getOrderStatsForUser } from "lib/auth/customer-orders";
// CUSTOM DATA MODEL
import User from "models/User.model";

// ==============================================================
type Props = { user: User };
// ==============================================================

export default async function UserAnalytics({ user }: Props) {
  const stats = await getOrderStatsForUser(user.id).catch(() => ({
    total: 0,
    pending: 0,
    processing: 0,
    delivered: 0
  }));

  const orderSummary = [
    { title: String(stats.total), subtitle: "Sve narudžbe" },
    { title: String(stats.pending), subtitle: "Na čekanju" },
    { title: String(stats.processing), subtitle: "U obradi" },
    { title: String(stats.delivered), subtitle: "Isporučeno" }
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={{ md: 6, xs: 12 }}>
        <Card
          elevation={0}
          sx={{
            gap: 2,
            height: "100%",
            display: "flex",
            border: "1px solid",
            alignItems: "center",
            padding: "1rem 1.5rem",
            borderColor: "grey.100"
          }}
        >
          <Avatar variant="rounded" sx={{ height: 65, width: 65 }}>
            <Image fill alt={user.name.firstName} src={user.avatar} sizes="(65px, 65px)" />
          </Avatar>

          <Typography variant="h5">{`${user.name.firstName} ${user.name.lastName}`}</Typography>
        </Card>
      </Grid>

      <Grid container spacing={3} size={{ md: 6, xs: 12 }}>
        {orderSummary.map((item) => (
          <Grid size={{ lg: 3, xs: 6 }} key={item.subtitle}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                flexDirection: "column",
                padding: "1rem 1.25rem",
                borderColor: "grey.100",
                borderStyle: "solid",
                borderWidth: 1
              }}
            >
              <Typography variant="h3" color="primary">
                {item.title}
              </Typography>

              <Typography
                fontSize={13}
                variant="body1"
                color="text.secondary"
                sx={{ textAlign: "center" }}
              >
                {item.subtitle}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Grid>
  );
}
