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
import SellerRow from "../seller-row";
import SearchArea from "../../search-box";
import PageWrapper from "../../page-wrapper";
// TABLE HEAD COLUMN DATA
import { tableHeading } from "../table-heading";
// DATA TYPES
import { Seller } from "../types";

// =============================================================================
type Props = { sellers: Seller[] };
// =============================================================================

export default function SellersPageView({ sellers }: Props) {
  const { order, orderBy, rowsPerPage, filteredList, handleChangePage, handleRequestSort } =
    useMuiTable({ listData: sellers });

  return (
    <PageWrapper title="Sellers">
      <SearchArea
        url="/admin/sellers"
        buttonText="Add New Seller"
        searchPlaceholder="Search Seller..."
      />

      <Card>
        <OverlayScrollbar>
          <TableContainer sx={{ minWidth: 1100 }}>
            <Table>
              <TableHeader
                order={order}
                orderBy={orderBy}
                heading={tableHeading}
                onRequestSort={handleRequestSort}
              />

              <TableBody>
                {filteredList.map((seller, index) => (
                  <SellerRow seller={seller} key={index} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </OverlayScrollbar>

        <Stack alignItems="center" my={4}>
          <TablePagination
            onChange={handleChangePage}
            count={Math.ceil(sellers.length / rowsPerPage)}
          />
        </Stack>
      </Card>
    </PageWrapper>
  );
}
