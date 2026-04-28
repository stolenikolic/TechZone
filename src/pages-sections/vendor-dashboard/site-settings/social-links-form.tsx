import { useForm } from "react-hook-form";
// MUI
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
// MUI ICON COMPONENTS
import Twitter from "@mui/icons-material/Twitter";
import YouTube from "@mui/icons-material/YouTube";
import Facebook from "@mui/icons-material/Facebook";
import Instagram from "@mui/icons-material/Instagram";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";
// CUSTOM ICON COMPONENTS
import PlayStore from "icons/PlayStore";
import AppleStore from "icons/AppleStore";

export default function SocialLinksForm() {
  const initialValues = {
    facebook: "",
    twitter: "",
    instagram: "",
    linkedin: "",
    youtube: "",
    play_store: "",
    app_store: ""
  };

  const methods = useForm({ defaultValues: initialValues });

  const {
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  // FORM SUBMIT HANDLER
  const handleSubmitForm = handleSubmit((values) => {
    alert(JSON.stringify(values, null, 2));
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Typography variant="h4">Social Links</Typography>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField
            fullWidth
            color="info"
            size="medium"
            name="facebook"
            label="Facebook"
            placeholder="https://example.com"
            slotProps={{
              input: {
                startAdornment: <Facebook fontSize="small" color="info" sx={{ mr: 1 }} />
              }
            }}
          />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField
            fullWidth
            color="info"
            size="medium"
            name="twitter"
            label="Twitter"
            placeholder="https://example.com"
            slotProps={{
              input: {
                startAdornment: <Twitter fontSize="small" color="info" sx={{ mr: 1 }} />
              }
            }}
          />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField
            fullWidth
            color="info"
            size="medium"
            name="instagram"
            label="Instagram"
            placeholder="https://example.com"
            slotProps={{
              input: {
                startAdornment: <Instagram fontSize="small" color="info" sx={{ mr: 1 }} />
              }
            }}
          />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField
            fullWidth
            color="info"
            size="medium"
            name="youtube"
            label="Youtube"
            placeholder="https://example.com"
            slotProps={{
              input: {
                startAdornment: <YouTube fontSize="small" color="info" sx={{ mr: 1 }} />
              }
            }}
          />
        </Grid>

        <Grid size={12}>
          <Divider />
        </Grid>

        <Grid size={12}>
          <Typography variant="h4">App Links</Typography>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField
            fullWidth
            color="info"
            size="medium"
            name="play_store"
            label="Play Store"
            placeholder="https://example.com"
            slotProps={{
              input: {
                startAdornment: <PlayStore fontSize="small" color="info" sx={{ mr: 1 }} />
              }
            }}
          />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField
            fullWidth
            color="info"
            size="medium"
            name="app_store"
            label="App Store"
            placeholder="https://example.com"
            slotProps={{
              input: {
                startAdornment: <AppleStore fontSize="small" color="info" sx={{ mr: 1 }} />
              }
            }}
          />
        </Grid>

        <Grid size={12}>
          <Button loading={isSubmitting} type="submit" color="info" variant="contained">
            Save Changes
          </Button>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
