import { useState } from "react";

// ================================================================
type Order = "asc" | "desc";
// ================================================================

export function descendingComparator(a: any, b: any, orderBy: string) {
  if (b[orderBy] < a[orderBy]) return -1;
  if (b[orderBy] > a[orderBy]) return 1;
  return 0;
}

export function getComparator<T>(order: Order, orderBy: string) {
  return order === "desc"
    ? (a: T, b: T) => descendingComparator(a, b, orderBy)
    : (a: T, b: T) => -descendingComparator(a, b, orderBy);
}

export function stableSort<T>(array: T[], comparator: (a: T, b: T) => number) {
  const stabilizedThis = array.map((el, index) => [el, index] as [T, number]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  return stabilizedThis.map((el) => el[0]);
}

// ================================================================
interface Props<T> {
  listData: T[];
  defaultSort?: string;
  defaultOrder?: "asc" | "desc";
}
// ================================================================

export default function useMuiTable<T>({
  listData = [],
  defaultSort = "name",
  defaultOrder = "asc"
}: Props<T>) {
  const [rowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const [orderBy, setOrderBy] = useState(defaultSort);
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<Order>(defaultOrder);

  // HANDLE DATA SORTING - (ASCENDING OR DESCENDING)
  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  // HANDLE SELECT ALL ROWS
  const handleSelectAllClick = (checked: boolean, defaultSelect: string) => {
    if (checked) {
      const newSelected = listData.map((item: any) => item[defaultSelect]);
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };

  // HANDLE SPECIFIC ROW OR DATA
  const handleRowClick = (name: string) => {
    const selectedIndex = selected.indexOf(name);
    let newSelected: string[] = [];
    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, name);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }
    setSelected(newSelected);
  };

  // HANDLE CHANGE PAGE
  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage - 1);

  const filteredList = stableSort(listData, getComparator(order, orderBy)).slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return {
    page,
    order,
    orderBy,
    selected,
    rowsPerPage,
    filteredList,
    handleRowClick,
    handleChangePage,
    handleRequestSort,
    handleSelectAllClick
  };
}
