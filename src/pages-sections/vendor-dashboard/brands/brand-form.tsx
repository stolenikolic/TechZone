"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM COMPONENTS
import DropZone from "components/DropZone";
import FlexBox from "components/flex-box/flex-box";
import { Checkbox, FormProvider, TextField } from "components/form-hook";
// STYLED COMPONENTS
import { UploadImageBox, StyledClear } from "../styles";
// CUSTOM DATA MODEL
import { PreviewFile } from "models/Common";

// FORM FIELDS VALIDATION SCHEMA
const validationSchema = yup.object().shape({
  name: yup.string().required("Name is required!")
});

// ================================================================
interface Props {}
// ================================================================

export default function BrandForm(props: Props) {
  const [files, setFiles] = useState<PreviewFile[]>([]);

  const initialValues = { name: "", featured: false };

  // HANDLE UPDATE NEW IMAGE VIA DROP ZONE
  const handleChangeDropZone = (files: File[]) => {
    files.forEach((file) => Object.assign(file, { preview: URL.createObjectURL(file) }));
    setFiles(files as PreviewFile[]);
  };

  // HANDLE DELETE UPLOAD IMAGE
  const handleFileDelete = (file: File) => () => {
    setFiles((files) => files.filter((item) => item.name !== file.name));
  };

  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });

  const {
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  // FORM SUBMIT HANDLER
  const handleSubmitForm = handleSubmit((values) => {
    alert(JSON.stringify(values, null, 2));
  });

  return (
    <Card className="p-3">
      <FormProvider methods={methods} onSubmit={handleSubmitForm}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <TextField
              fullWidth
              name="name"
              label="Name"
              color="info"
              size="medium"
              placeholder="Name"
            />
          </Grid>

          <Grid size={12}>
            <DropZone onChange={(files) => handleChangeDropZone(files)} />

            <FlexBox flexDirection="row" mt={2} flexWrap="wrap" gap={1}>
              {files.map((file, index) => {
                return (
                  <UploadImageBox key={index}>
                    <Box component="img" alt="product" src={file.preview} width="100%" />
                    <StyledClear onClick={handleFileDelete(file)} />
                  </UploadImageBox>
                );
              })}
            </FlexBox>
          </Grid>

          <Grid size={{ sm: 6, xs: 12 }}>
            <Checkbox color="info" name="featured" label="Featured Brand" />
          </Grid>

          <Grid size={12}>
            <Button loading={isSubmitting} variant="contained" color="info" type="submit">
              Save brand
            </Button>
          </Grid>
        </Grid>
      </FormProvider>
    </Card>
  );
}
