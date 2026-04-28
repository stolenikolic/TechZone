export const classes = () => {
  const obj = {} as Record<string, React.CSSProperties>;

  for (let i = 1; i <= 5; i++) {
    // PADDING
    obj[`.p-${i}`] = { padding: i + "rem" };
    obj[`.pt-${i}`] = { paddingTop: i + "rem" };
    obj[`.pb-${i}`] = { paddingBottom: i + "rem" };

    // MARGIN
    obj[`.m-${i}`] = { margin: i + "rem" };
    obj[`.mt-${i}`] = { marginTop: i + "rem" };
    obj[`.mb-${i}`] = { marginBottom: i + "rem" };
  }

  return obj;
};
