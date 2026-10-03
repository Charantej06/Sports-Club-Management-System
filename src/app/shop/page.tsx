import { publicData } from "@/modules/public/queries";
import { ShopView } from "@/components/shop-view";
export const metadata = { title: "The Champions Shop" };
export default async function Shop() { const data = await publicData(); return <ShopView products={data.products}/>; }
