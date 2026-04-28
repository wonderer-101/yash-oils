import ProductsClientPage from "./ProductsClientPage";

export const metadata = {
  title: "Products | Yash World of Wellness",
  description: "Browse Ayurvedic products from Yash World of Wellness.",
};

export default async function ProductsPage({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";
  return <ProductsClientPage query={query} />;
}

