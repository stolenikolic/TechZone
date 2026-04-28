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
import ReviewRow from "../review-row";
import PageWrapper from "../../page-wrapper";
import { tableHeading } from "../table-heading";
// CUSTOM DATA MODEL
import { Review } from "../types";

// =============================================================================
type Props = { reviews: Review[] };
// =============================================================================

export default function ReviewsPageView({ reviews }: Props) {
  const { order, orderBy, rowsPerPage, filteredList, handleChangePage, handleRequestSort } =
    useMuiTable({ listData: reviews });

  return (
    <PageWrapper title="Product Reviews">
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
                {filteredList.map((review, index) => (
                  <ReviewRow review={review} key={index} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </OverlayScrollbar>

        <Stack alignItems="center" my={4}>
          <TablePagination
            onChange={handleChangePage}
            count={Math.ceil(reviews.length / rowsPerPage)}
          />
        </Stack>
      </Card>
    </PageWrapper>
  );
}
