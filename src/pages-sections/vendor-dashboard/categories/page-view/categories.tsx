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
import CategoryRow from "../category-row";
import SearchArea from "../../search-box";
import PageWrapper from "../../page-wrapper";
// CUSTOM DATA MODEL
import { tableHeading } from "../table-heading";

// =============================================================================
type CategoryListRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  productCount: number;
  topPickCount: number;
};
type Props = { categories: CategoryListRow[] };
// =============================================================================

const CategoriesPageView = ({ categories }: Props) => {
  const byId = new Map(categories.map((item) => [item.id, item]));
  // RESHAPE THE PRODUCT LIST BASED TABLE HEAD CELL ID
  const filteredCategories = categories.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    image: item.image_url ?? "/assets/images/categories/default-category.jpg",
    level: (() => {
      let level = 0;
      let cursor = item.parent_id;
      while (cursor) {
        level += 1;
        cursor = byId.get(cursor)?.parent_id ?? null;
      }
      return level;
    })(),
    productCount: item.productCount ?? 0,
    topPickCount: item.topPickCount ?? 0
  }));

  const { order, orderBy, rowsPerPage, filteredList, handleChangePage, handleRequestSort } =
    useMuiTable({ listData: filteredCategories });

  return (
    <PageWrapper title="Product Categories">
      <SearchArea
        buttonText="Add Category"
        url="/admin/categories/create"
        searchPlaceholder="Search Category..."
      />

      <Card>
        <OverlayScrollbar>
          <TableContainer sx={{ minWidth: 900 }}>
            <Table>
              <TableHeader
                order={order}
                orderBy={orderBy}
                heading={tableHeading}
                onRequestSort={handleRequestSort}
              />

              <TableBody>
                {filteredList.map((category) => (
                  <CategoryRow key={category.id} category={category} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </OverlayScrollbar>

        <Stack alignItems="center" my={4}>
          <TablePagination
            onChange={handleChangePage}
            count={Math.ceil(categories.length / rowsPerPage)}
          />
        </Stack>
      </Card>
    </PageWrapper>
  );
};

export default CategoriesPageView;
