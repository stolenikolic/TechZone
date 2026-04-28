"use client";

import Image from "next/image";
// MUI
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import CameraEnhance from "@mui/icons-material/CameraEnhance";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";

export default function ProfilePicUpload({ image }: { image: string }) {
  return (
    <FlexBox alignItems="flex-end" mb={4}>
      <Avatar sx={{ height: 60, width: 60 }}>
        <Image fill alt="user" src={image} sizes="(60px, 60px)" />
      </Avatar>

      <IconButton
        size="small"
        component="label"
        color="secondary"
        htmlFor="profile-image"
        sx={{ bgcolor: "grey.300", ml: -2.5 }}
      >
        <CameraEnhance fontSize="small" />
      </IconButton>

      <Box
        type="file"
        display="none"
        accept="image/*"
        component="input"
        id="profile-image"
        onChange={(e) => console.log(e.target.files)}
      />
    </FlexBox>
  );
}
