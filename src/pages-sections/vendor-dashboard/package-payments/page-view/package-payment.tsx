"use client";

import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
// GLOBAL CUSTOM COMPONENTS
import OverlayScrollbar from "components/overlay-scrollbar";
import { TableHeader, TablePagination } from "components/data-table";
// GLOBAL CUSTOM HOOK
import useMuiTable from "hooks/useMuiTable";
// LOCAL CUSTOM COMPONENT
import PaymentRow from "../payment-row";
import PageWrapper from "../../page-wrapper";
// TABLE HEAD COLUMN DATA
import { tableHeading } from "../table-heading";
// DATA TYPES
import { PackagePayment } from "../types";

// ==============================================================
type Props = { payments: PackagePayment[] };
// ==============================================================

export default function PackagePaymentPageView({ payments }: Props) {
  const { order, orderBy, rowsPerPage, filteredList, handleChangePage, handleRequestSort } =
    useMuiTable({ listData: payments, defaultSort: "no" });

  return (
    <PageWrapper title="Package Payments">
      <Card>
        <OverlayScrollbar>
          <TableContainer sx={{ minWidth: 1000 }}>
            <Table>
              <TableHeader
                order={order}
                orderBy={orderBy}
                heading={tableHeading}
                onRequestSort={handleRequestSort}
              />

              <TableBody>
                {filteredList.map((item, index) => (
                  <PaymentRow payment={item} key={index} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </OverlayScrollbar>

        <Stack alignItems="center" my={4}>
          <TablePagination
            onChange={handleChangePage}
            count={Math.ceil(payments.length / rowsPerPage)}
          />
        </Stack>
      </Card>
    </PageWrapper>
  );
}
