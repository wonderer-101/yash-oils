import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import YashProductDetailView from "@/components/product/YashProductDetailView";
import { getAdminProductByHandle } from "@/lib/shopify/products";

export async function generateMetadata({ params }) {
  const { handle } = await params;
  try {
    const product = await getAdminProductByHandle(handle);
    if (!product) {
      return { title: "Products | Yash World of Wellness" };
    }
    return {
      title: `${product.title} | Yash World of Wellness`,
      description:
        product.description?.slice(0, 155) ||
        "Explore Ayurvedic wellness products from Yash World of Wellness.",
    };
  } catch {
    return { title: "Products | Yash World of Wellness" };
  }
}

export default async function ProductHandlePage({ params }) {
  const { handle } = await params;

  let product = null;
  try {
    product = await getAdminProductByHandle(handle);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("[yash-products] fetch failed:", details);
  }

  if (!product) {
    notFound();
  }

  return (
    <>
      <Header />
      <YashProductDetailView product={product} />
      <Footer />
    </>
  );
}
