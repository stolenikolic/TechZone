import { Fragment } from "react";
// CUSTOM COMPONENT
import Location from "icons/Location";
import Pagination from "../../pagination";
import AddressListItem from "../address-item";
import DashboardHeader from "../../dashboard-header";
// CUSTOM DATA MODEL
import Address from "models/Address.model";

// =======================================================
interface Props {
  totalPages: number;
  addresses: Address[];
}
// =======================================================

export function AddressPageView({ addresses, totalPages }: Props) {
  return (
    <Fragment>
      <DashboardHeader Icon={Location} title="My Addresses" />

      {addresses.map((address) => (
        <AddressListItem key={address.id} address={address} />
      ))}

      <Pagination count={totalPages} />
    </Fragment>
  );
}
