"use client";

import { useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Link from "@mui/material/Link";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
import { FormProvider, TextField } from "components/form-hook";
import { useAuth } from "contexts/AuthContext";
import { signInWithEmail, resendSignupConfirmation } from "lib/auth/actions";
import { submitProductReview } from "lib/reviews/actions";
import type { ViewerReview } from "lib/reviews/types";
import Label from "pages-sections/sessions/components/label";
import EyeToggleButton from "pages-sections/sessions/components/eye-toggle-button";
import usePasswordVisible from "pages-sections/sessions/use-password-visible";
import { RatingGroup } from "./styles";

type FormValues = {
  rating: number;
  comment: string;
};

type LoginValues = {
  email: string;
  password: string;
};

const validationSchema = yup.object({
  rating: yup
    .number()
    .typeError("Ocjena je obavezna.")
    .min(1, "Ocjena je obavezna.")
    .max(5, "Ocjena je obavezna.")
    .required("Ocjena je obavezna."),
  comment: yup.string().max(1000, "Recenzija može imati najviše 1000 znakova.").default("")
});

const loginSchema = yup.object({
  email: yup.string().email("Neispravna e-mail adresa").required("E-mail je obavezan"),
  password: yup.string().required("Lozinka je obavezna")
});

function draftKey(productId: string) {
  return `review-draft:${productId}`;
}

function readDraft(productId: string): FormValues | null {
  try {
    const raw = sessionStorage.getItem(draftKey(productId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormValues>;
    const rating = Number(parsed.rating);
    if (!Number.isFinite(rating)) return null;
    return { rating, comment: typeof parsed.comment === "string" ? parsed.comment : "" };
  } catch {
    return null;
  }
}

function saveDraft(productId: string, values: FormValues) {
  try {
    sessionStorage.setItem(draftKey(productId), JSON.stringify(values));
  } catch {
    // Private mode can block storage. The open dialog still keeps the values in state.
  }
}

function clearDraft(productId: string) {
  try {
    sessionStorage.removeItem(draftKey(productId));
  } catch {
    // Ignore storage failures.
  }
}

function clearedKey(productId: string) {
  return `review-form-cleared:${productId}`;
}

function markFormCleared(productId: string) {
  try {
    sessionStorage.setItem(clearedKey(productId), String(Date.now()));
  } catch {
    // Private mode can block storage. The in-memory flag still clears this mount.
  }
}

function consumeClearedForm(productId: string) {
  try {
    const raw = sessionStorage.getItem(clearedKey(productId));
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || Date.now() - at > 15000) {
      sessionStorage.removeItem(clearedKey(productId));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export default function ReviewForm({ productId, productSlug }: { productId: string; productSlug: string }) {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const { visiblePassword, togglePasswordVisible } = usePasswordVisible();
  const [hidden, setHidden] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pending, setPending] = useState<FormValues | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const ignorePrefill = useRef(false);

  const methods = useForm<FormValues>({
    defaultValues: { rating: 0, comment: "" },
    resolver: yupResolver(validationSchema)
  });
  const loginMethods = useForm<LoginValues>({
    defaultValues: { email: "", password: "" },
    resolver: yupResolver(loginSchema)
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors }
  } = methods;

  useEffect(() => {
    if (ignorePrefill.current || consumeClearedForm(productId)) return;
    const draft = readDraft(productId);
    if (draft) reset(draft);
  }, [productId, reset]);

  useEffect(() => {
    if (!user || ignorePrefill.current || consumeClearedForm(productId)) return;
    let active = true;

    fetch(`/api/product-reviews/${productId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("review state failed");
        return (await response.json()) as { review: ViewerReview | null };
      })
      .then((data) => {
        if (!active || ignorePrefill.current || consumeClearedForm(productId) || !data.review) return;
        setHidden(data.review.status === "hidden");
      })
      .catch(() => {
        // The form stays usable if the existing review cannot be loaded.
      });

    return () => {
      active = false;
    };
  }, [productId, user]);

  const publish = async (values: FormValues) => {
    setFormError(null);
    setSaved(false);
    const result = await submitProductReview(productId, values.rating, values.comment ?? "");
    if (!result.ok) {
      if (result.code === "auth") {
        saveDraft(productId, values);
        setPending(values);
        setLoginOpen(true);
        return;
      }
      setFormError(result.message);
      return;
    }
    clearDraft(productId);
    markFormCleared(productId);
    ignorePrefill.current = true;
    reset({ rating: 0, comment: "" });
    setHidden(false);
    setPending(null);
    setSaved(true);
    setLoginOpen(false);
    router.refresh();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (authLoading) return;
    if (!user) {
      saveDraft(productId, values);
      setPending(values);
      setLoginError(null);
      setLoginOpen(true);
      return;
    }
    await publish(values);
  });

  const onLogin = loginMethods.handleSubmit(async (values) => {
    setLoginError(null);
    setUnconfirmedEmail(null);
    setResendMessage(null);

    const { data, error: signInError } = await signInWithEmail(values.email, values.password);
    if (signInError) {
      const msg = signInError.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setUnconfirmedEmail(values.email);
        setLoginError("E-mail nije potvrđen. Provjerite pristiglu poštu ili pošaljite link ponovo.");
      } else if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
        setLoginError("Pogrešan e-mail ili lozinka.");
      } else {
        setLoginError(signInError.message);
      }
      return;
    }

    if (!data.session) {
      setLoginError("Prijava nije uspjela. Pokušajte ponovo.");
      return;
    }

    await refresh();
    if (pending) await publish(pending);
  });

  const handleResend = async () => {
    if (!unconfirmedEmail) return;
    setResendMessage(null);
    const { error: resendError } = await resendSignupConfirmation(unconfirmedEmail);
    setResendMessage(resendError ? resendError.message : "Link za potvrdu je ponovo poslat.");
  };

  const registerHref = `/registracija?next=${encodeURIComponent(`/proizvodi/${productSlug}`)}`;

  return (
    <>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <Typography variant="h3" sx={{ mt: 7, mb: 2.5 }}>
          Napišite recenziju ovog proizvoda
        </Typography>

        {hidden ? (
          <Alert severity="info" sx={{ mb: 2, maxWidth: 640 }}>
            Vaša recenzija trenutno nije javno prikazana.
          </Alert>
        ) : null}

        {saved ? (
          <Alert severity="success" sx={{ mb: 2, maxWidth: 640 }}>
            Recenzija je sačuvana.
          </Alert>
        ) : null}

        {formError ? (
          <Alert severity="error" sx={{ mb: 2, maxWidth: 640 }}>
            {formError}
          </Alert>
        ) : null}

        <RatingGroup>
          <Typography variant="h6" sx={{ color: "grey.700", span: { color: "error.main" } }}>
            Vaša ocjena <span>*</span>
          </Typography>

          <Box>
            <Controller
              name="rating"
              control={control}
              render={({ field }) => (
                <Rating
                  color="warn"
                  size="medium"
                  name={field.name}
                  value={field.value}
                  onChange={(_, value) => field.onChange(value ?? 0)}
                />
              )}
            />
            {errors.rating ? (
              <Typography variant="body2" color="error">
                {errors.rating.message}
              </Typography>
            ) : null}
          </Box>
        </RatingGroup>

        <Box mb={3} maxWidth={640}>
          <Typography variant="h6" sx={{ mb: 1, color: "grey.700" }}>
            Vaša recenzija
          </Typography>

          <TextField
            rows={8}
            multiline
            fullWidth
            name="comment"
            variant="outlined"
            placeholder="Napišite recenziju ovdje..."
          />
        </Box>

        <Button loading={isSubmitting} variant="contained" color="primary" type="submit">
          Pošalji
        </Button>
      </FormProvider>

      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Prijavite se da biste objavili recenziju</DialogTitle>
        <DialogContent>
          <FormProvider methods={loginMethods} onSubmit={onLogin}>
            {loginError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {loginError}
                {unconfirmedEmail ? (
                  <Button size="small" onClick={handleResend} sx={{ mt: 1, display: "block" }}>
                    Pošalji link za potvrdu ponovo
                  </Button>
                ) : null}
              </Alert>
            ) : null}
            {resendMessage ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {resendMessage}
              </Alert>
            ) : null}

            <Box mb={2}>
              <Label>E-mail</Label>
              <TextField fullWidth name="email" type="email" placeholder="primjer@mail.com" autoFocus />
            </Box>

            <Box mb={2}>
              <Label>Lozinka</Label>
              <TextField
                fullWidth
                name="password"
                autoComplete="current-password"
                placeholder="*********"
                type={visiblePassword ? "text" : "password"}
                slotProps={{
                  input: {
                    endAdornment: <EyeToggleButton show={visiblePassword} click={togglePasswordVisible} />
                  }
                }}
              />
            </Box>

            <Button
              fullWidth
              size="large"
              type="submit"
              color="primary"
              variant="contained"
              loading={loginMethods.formState.isSubmitting}
            >
              Prijava
            </Button>

            <Typography variant="body2" sx={{ mt: 2, color: "grey.700" }}>
              Nemate nalog?{" "}
              <Link component={NextLink} href={registerHref} onClick={() => pending && saveDraft(productId, pending)}>
                Registrujte se
              </Link>
            </Typography>
          </FormProvider>
        </DialogContent>
      </Dialog>
    </>
  );
}
