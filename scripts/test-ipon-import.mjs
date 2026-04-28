/**
 * Test IPON import end-to-end.
 * Run with: node scripts/test-ipon-import.mjs
 * Ensure dev server is running: npm run dev
 */
const url = "http://localhost:3000/api/suppliers/ipon/import-category";
const body = {
  supplierCategoryId: 98,
  internalCategoryId: "b7acf048-472c-4d15-af63-a9c78883ba15" // Procesori category UUID
};

console.log("Calling POST", url);
console.log("Body:", JSON.stringify(body, null, 2));

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

const responseBody = await res.text();
let parsed;
try {
  parsed = JSON.parse(responseBody);
} catch {
  parsed = responseBody;
}

console.log("---");
console.log("response.status:", res.status);
console.log("response body:", typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
