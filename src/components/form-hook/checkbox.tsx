import { useFormContext, Controller } from "react-hook-form";
import FormHelperText from "@mui/material/FormHelperText";
import MuiCheckbox, { CheckboxProps } from "@mui/material/Checkbox";
import FormControlLabel, { FormControlLabelProps } from "@mui/material/FormControlLabel";

// ==============================================================
interface Props extends Omit<FormControlLabelProps, "control"> {
  name: string;
  size?: CheckboxProps["size"];
  color?: CheckboxProps["color"];
}
// ==============================================================

export default function Checkbox({ name, size, color, ...other }: Props) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <div>
          <FormControlLabel
            control={<MuiCheckbox {...field} checked={field.value} size={size} color={color} />}
            {...other}
          />
          {Boolean(error) && <FormHelperText error>{error?.message}</FormHelperText>}
        </div>
      )}
    />
  );
}
