"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { TextField, FormProvider } from "components/form-hook";
import Label from "../components/label";
import EyeToggleButton from "../components/eye-toggle-button";
import usePasswordVisible from "../use-password-visible";
import { useAuth } from "contexts/AuthContext";
import { signInWithEmail, resendSignupConfirmation } from "lib/auth/actions";

const validationSchema = yup.object().shape({
  password: yup.string().required("Password is required"),
  email: yup.string().email("Invalid Email Address").required("Email is required")
});

/** Safe internal path from ?next=, or null to close modal / stay on current page. */
function resolvePostLoginPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export default function LoginPageView() {
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { visiblePassword, togglePasswordVisible } = usePasswordVisible();
  const [error, setError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const initialValues = { email: "", password: "" };

  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });

  const {
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  const handleResend = async () => {
    if (!unconfirmedEmail) return;
    setResendMessage(null);
    const { error: resendError } = await resendSignupConfirmation(unconfirmedEmail);
    setResendMessage(
      resendError ? resendError.message : "Confirmation link has been sent again."
    );
  };

  const handleSubmitForm = handleSubmit(async (values) => {
    setError(null);
    setUnconfirmedEmail(null);
    setResendMessage(null);

    const { data, error: signInError } = await signInWithEmail(values.email, values.password);

    if (signInError) {
      const msg = signInError.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setUnconfirmedEmail(values.email);
        setError("Email is not confirmed. Check your inbox or resend the link.");
      } else {
        setError(signInError.message);
      }
      return;
    }

    if (!data.session) {
      setError("Login failed. Please try again.");
      return;
    }

    await refreshAuth();

    const dest = resolvePostLoginPath(next);
    if (dest) {
      router.replace(dest);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace("/");
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          {unconfirmedEmail && (
            <Button size="small" onClick={handleResend} sx={{ mt: 1, display: "block" }}>
              Resend confirmation link
            </Button>
          )}
        </Alert>
      )}
      {resendMessage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {resendMessage}
        </Alert>
      )}

      <div className="mb-1">
        <Label>Email or Phone Number</Label>
        <TextField
          fullWidth
          name="email"
          type="email"
          size="medium"
          placeholder="exmple@mail.com"
        />
      </div>

      <div className="mb-2">
        <Label>Password</Label>
        <TextField
          fullWidth
          size="medium"
          name="password"
          autoComplete="on"
          placeholder="*********"
          type={visiblePassword ? "text" : "password"}
          slotProps={{
            input: {
              endAdornment: <EyeToggleButton show={visiblePassword} click={togglePasswordVisible} />
            }
          }}
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
        Login
      </Button>
    </FormProvider>
  );
}
