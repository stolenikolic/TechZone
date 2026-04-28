import { importCategory } from "lib/suppliers/ipon/importProducts";

export async function POST(request: Request) {
  console.log("POST HANDLER STARTED");

  const body = await request.json();

  console.log("About to call importCategory");

  const result = await importCategory(
    body.supplierCategoryId,
    body.internalCategoryId
  );

  console.log("IMPORT FUNCTION FINISHED");

  return Response.json(result);
}
