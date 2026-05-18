"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { TextField, FormProvider } from "components/form-hook";
import { createSupabaseBrowserClient } from "utils/supabase/browser";
import Label from "../components/label";
import EyeToggleButton from "../components/eye-toggle-button";
import usePasswordVisible from "../use-password-visible";

const validationSchema = yup.object().shape({
  password: yup.string().min(8, "Lozinka mora imati najmanje 8 znakova").required("Lozinka je obavezna"),
  re_password: yup
    .string()
    .oneOf([yup.ref("password")], "Lozinke se ne podudaraju")
    .required("Ponovite lozinku")
});

export default function UpdatePasswordPageView() {
  const router = useRouter();
  const { visiblePassword, togglePasswordVisible } = usePasswordVisible();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const methods = useForm({
    defaultValues: { password: "", re_password: "" },
    resolver: yupResolver(validationSchema)
  });

  const {
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  const inputProps = {
    endAdornment: <EyeToggleButton show={visiblePassword} click={togglePasswordVisible} />
  };

  const handleSubmitForm = handleSubmit(async (values) => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password });

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 2000);
  });

  return (
    <>
      <Typography variant="h3" fontWeight={700} sx={{ mb: 4, textAlign: "center" }}>
        Nova lozinka
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Lozinka je promijenjena. Preusmjeravamo na prijavu…
        </Alert>
      )}

      <FormProvider methods={methods} onSubmit={handleSubmitForm}>
        <div className="mb-1">
          <Label>Nova lozinka</Label>
          <TextField
            fullWidth
            name="password"
            size="medium"
            type={visiblePassword ? "text" : "password"}
            slotProps={{ input: inputProps }}
          />
        </div>

        <div className="mb-2">
          <Label>Ponovite lozinku</Label>
          <TextField
            fullWidth
            name="re_password"
            size="medium"
            type={visiblePassword ? "text" : "password"}
            slotProps={{ input: inputProps }}
          />
        </div>

        <Button
          fullWidth
          size="large"
          type="submit"
          color="primary"
          variant="contained"
          loading={isSubmitting}
          disabled={success}
        >
          Sačuvaj lozinku
        </Button>
      </FormProvider>
    </>
  );
}
