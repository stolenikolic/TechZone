import { Fragment } from "react";
import Card from "@mui/material/Card";
// LOCAL CUSTOM COMPONENT
import ProfileEditForm from "../edit-form";
import ProfilePicUpload from "../profile-pic-upload";
import DashboardHeader from "../../dashboard-header";
// CUSTOM DATA MODEL
import User from "models/User.model";

// ===========================================================
type Props = { user: User };
// ===========================================================

export function ProfileEditPageView({ user }: Props) {
  return (
    <Fragment>
      <DashboardHeader href="/profile" title="Edit Profile" />

      <Card sx={{ padding: { xs: 3, sm: 4 } }}>
        <ProfilePicUpload image={user.avatar} />
        {user && <ProfileEditForm user={user} />}
      </Card>
    </Fragment>
  );
}
