import FormLabel, { FormLabelProps } from "@mui/material/FormLabel";

export default function Label({ children }: FormLabelProps) {
  return (
    <FormLabel
      sx={{
        mb: 1,
        fontSize: 14,
        fontWeight: 500,
        display: "block",
        color: "text.secondary"
      }}
    >
      {children}
    </FormLabel>
  );
}
