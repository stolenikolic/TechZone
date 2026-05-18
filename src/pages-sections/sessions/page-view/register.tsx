"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Checkbox, TextField, FormProvider } from "components/form-hook";
import EyeToggleButton from "../components/eye-toggle-button";
import Label from "../components/label";
import BoxLink from "../components/box-link";
import usePasswordVisible from "../use-password-visible";
import FlexBox from "components/flex-box/flex-box";
import { signUpWithEmail } from "lib/auth/actions";

const validationSchema = yup.object().shape({
  name: yup.string().required("Ime je obavezno"),
  email: yup.string().email("Neispravna email adresa").required("Email je obavezan"),
  password: yup.string().min(8, "Lozinka mora imati najmanje 8 znakova").required("Lozinka je obavezna"),
  re_password: yup
    .string()
    .oneOf([yup.ref("password")], "Lozinke se ne podudaraju")
    .required("Ponovite lozinku"),
  agreement: yup
    .bool()
    .test("agreement", "Morate prihvatiti uslove korištenja.", (value) => value === true)
    .required("Morate prihvatiti uslove korištenja.")
});

export default function RegisterPageView() {
  const router = useRouter();
  const { visiblePassword, togglePasswordVisible } = usePasswordVisible();
  const [error, setError] = useState<string | null>(null);

  const inputProps = {
    endAdornment: <EyeToggleButton show={visiblePassword} click={togglePasswordVisible} />
  };

  const initialValues = {
    name: "",
    email: "",
    password: "",
    re_password: "",
    agreement: false
  };

  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });

  const {
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  const handleSubmitForm = handleSubmit(async (values) => {
    setError(null);
    const { error: signUpError } = await signUpWithEmail(values.email, values.password, values.name);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    router.push("/auth/confirm");
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <div className="mb-1">
        <Label>Ime i prezime</Label>
        <TextField fullWidth name="name" size="medium" placeholder="Ime Prezime" />
      </div>

      <div className="mb-1">
        <Label>Email</Label>
        <TextField fullWidth name="email" size="medium" type="email" placeholder="primjer@mail.com" />
      </div>

      <div className="mb-1">
        <Label>Lozinka</Label>
        <TextField
          fullWidth
          size="medium"
          name="password"
          placeholder="*********"
          type={visiblePassword ? "text" : "password"}
          slotProps={{ input: inputProps }}
        />
      </div>

      <div className="mb-1">
        <Label>Ponovite lozinku</Label>
        <TextField
          fullWidth
          size="medium"
          name="re_password"
          placeholder="*********"
          type={visiblePassword ? "text" : "password"}
          slotProps={{ input: inputProps }}
        />
      </div>

      <div className="agreement">
        <Checkbox
          name="agreement"
          size="small"
          color="secondary"
          label={
            <FlexBox flexWrap="wrap" alignItems="center" justifyContent="flex-start" gap={1}>
              <Box display={{ sm: "inline-block", xs: "none" }}>Registracijom prihvatate</Box>
              <Box display={{ sm: "none", xs: "inline-block" }}>Prihvatam</Box>
              <BoxLink title="Uslove korištenja" href="/" />
            </FlexBox>
          }
        />
      </div>

      <Button
        fullWidth
        size="large"
        type="submit"
        color="primary"
        variant="contained"
        loading={isSubmitting}
      >
        Registracija
      </Button>
    </FormProvider>
  );
}
