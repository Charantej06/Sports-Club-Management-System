import { pageUser } from "@/lib/access";
import { Account } from "@/components/account";
export const metadata = { title: "My Account" };
export default async function AccountPage() { await pageUser(); return <Account/>; }
