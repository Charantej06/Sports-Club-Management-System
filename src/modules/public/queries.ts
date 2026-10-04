import { db } from "@/lib/db";
import { productImage } from "@/modules/shop/product-images";
const menuImages: Record<string, string> = {
  "avocado-toast": "/images/clubhouse/menu/avocado-toast.jpg",
  omelette: "/images/clubhouse/menu/omelette.jpg",
  smoothie: "/images/clubhouse/menu/smoothie.jpg",
  "cold-coffee": "/images/clubhouse/menu/cold-coffee.jpg",
  lemonade: "/images/clubhouse/menu/smoothie.jpg",
  salad: "/images/clubhouse/menu/salad.jpg",
  burger: "/images/clubhouse/menu/burger.jpg",
  pasta: "/images/clubhouse/menu/pasta.jpg",
  sandwich: "/images/clubhouse/menu/sandwich.jpg",
  fries: "/images/clubhouse/menu/fries.jpg",
  hummus: "/images/clubhouse/menu/hummus.jpg",
  coffee: "/images/clubhouse/menu/coffee.jpg",
  beer: "/images/clubhouse/menu/beer.jpg",
  mocktail: "/images/clubhouse/menu/mocktail.jpg",
};
export async function publicData() {
  const [sports, plans, products, menu, settings] = await Promise.all([
    db.sport.findMany({ orderBy: { sortOrder: "asc" }, include: { courts: { where: { active: true }, select: { id: true, name: true, hourlyPaise: true, indoor: true } } } }),
    db.membershipPlan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({ where: { active: true }, include: { variants: { select: { id: true, label: true, pricePaise: true, stock: true, reserved: true } } }, orderBy: { name: "asc" } }),
    db.menuItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.clubSettings.findUniqueOrThrow({ where: { id: "club" } }),
  ]);
  return {
    sports, plans: plans.map(({ updatedAt, ...plan }) => ({ ...plan, planVersion: updatedAt.toISOString() })),
    products: products.map(p => ({ ...p, image: productImage(p.id, p.image), variants: p.variants.map(v => ({ id: v.id, label: v.label, pricePaise: v.pricePaise, available: Math.max(0, v.stock - v.reserved) })) })),
    menu: menu.map(item => ({ ...item, image: menuImages[item.id] ?? item.image })), settings: { timezone: settings.timezone, openHour: settings.openHour, closeHour: settings.closeHour, bookingWindowDays: settings.bookingWindowDays, dailySessionLimit:settings.dailySessionLimit,cancellationHours:settings.cancellationHours,deliveryFeePaise:settings.deliveryFeePaise, address: settings.address, contactEmail: settings.contactEmail, contactPhone: settings.contactPhone },
  };
}
