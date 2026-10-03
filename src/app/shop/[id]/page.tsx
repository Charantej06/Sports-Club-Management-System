import { notFound } from "next/navigation";
import { publicData } from "@/modules/public/queries";
import { ProductDetail } from "@/components/product-detail";
export default async function Product({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const product = (await publicData()).products.find(p => p.id === id); if (!product) notFound(); return <ProductDetail product={product}/>; }
