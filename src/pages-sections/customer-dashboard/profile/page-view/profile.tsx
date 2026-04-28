import { Fragment } from "react";
// CUSTOM COMPONENTS
import User3 from "icons/User3";
import UserInfo from "../user-info";
import UserAnalytics from "../user-analytics";
import DashboardHeader from "../../dashboard-header";
// CUSTOM DATA MODEL
import User from "models/User.model";

// ============================================================
type Props = { user: User };
// ============================================================

export function ProfilePageView({ user }: Props) {
  return (
    <Fragment>
      <DashboardHeader title="My Profile" Icon={User3} />
      <UserAnalytics user={user} />
      <UserInfo user={user} />
    </Fragment>
  );
}
