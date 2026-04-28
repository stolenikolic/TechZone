import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import Container from "components/Container";
import IconComponent from "components/IconComponent";
// STYLED COMPONENTS
import { StyledRoot, ServiceItem } from "./styles";
// API FUNCTIONS
import api from "utils/__api__/market-2";

export default async function Section2() {
  const services = await api.getServices();
  if (!services || !services.length) return null;

  return (
    <Container>
      <StyledRoot>
        {services.map((item, ind) => (
          <ServiceItem key={ind}>
            <IconComponent icon={item.icon} sx={{ fontSize: 40, color: "grey.500" }} />

            <div>
              <Typography variant="body1" fontWeight={600} fontSize={{ sm: 18, xs: 16 }}>
                {item.title}
              </Typography>

              <Typography variant="body1" color="text.secondary">
                {item.description}
              </Typography>
            </div>
          </ServiceItem>
        ))}
      </StyledRoot>
    </Container>
  );
}
