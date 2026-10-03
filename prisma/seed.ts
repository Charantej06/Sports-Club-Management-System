import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { purchaseMembership } from "../src/modules/membership/service";
import type { Role } from "../src/generated/prisma/client";

const sports = [
  { id: "tennis", name: "Tennis", description: "Find your rhythm on championship hard courts. Rally with friends, refine your serve, or make every set count.", image: "/images/tennis.jpg", rate: 80000, count: 3 },
  { id: "padel", name: "Padel", description: "Fast rallies. Big laughs. Discover the doubles game that brings everyone together on our panoramic glass courts.", image: "/images/padel-court.jpg", rate: 120000, count: 2 },
  { id: "badminton", name: "Badminton", description: "Quick feet, sharp reflexes and one more game. Play on indoor wooden courts with tournament-quality lighting.", image: "/images/badminton.jpg", rate: 50000, count: 4 },
  { id: "cricket", name: "Cricket", description: "From your first cover drive to match-day preparation. Book practice nets and build your game, ball by ball.", image: "/images/cricket.jpg", rate: 60000, count: 2 },
];
const plans = [
  { id: "silver", name: "Silver", description: "Your regular spot on the court.", pricePaise: 650000, courtDiscountBps: 1500, shopDiscountBps: 500, foodDiscountBps: 500, freeSessionsWeek: 0, sortOrder: 1 },
  { id: "gold", name: "Gold", description: "More play. Every advantage.", pricePaise: 1200000, courtDiscountBps: 2500, shopDiscountBps: 1500, foodDiscountBps: 1500, freeSessionsWeek: 2, sortOrder: 2 },
  { id: "junior", name: "Junior", description: "Big dreams start with a little play.", pricePaise: 350000, courtDiscountBps: 2000, shopDiscountBps: 1000, foodDiscountBps: 1000, freeSessionsWeek: 1, juniorOnly: true, sortOrder: 3 },
];
// Prices in rupees here are converted once to integer paise below.
const catalogue: [string, string, string, string, number, string, boolean?][] = [
  ["pro-tour-98", "Pro Tour 98 Racket", "tennis", "Rackets", 12999, "racket", true],
  ["club-100", "Club 100 Tennis Racket", "tennis", "Rackets", 7499, "racket"],
  ["tennis-balls", "Championship Tennis Balls · 3", "tennis", "Balls", 449, "ball"],
  ["tennis-strings", "Spin Control Polyester Strings", "tennis", "Strings", 899, "grip"],
  ["tennis-grip", "Tour Overgrips · Pack of 3", "tennis", "Grips", 349, "grip"],
  ["tennis-bag", "Court Six-Racket Bag", "tennis", "Bags", 3999, "bag"],
  ["padel-carbon", "Carbon Pro Padel Racket", "padel", "Rackets", 15999, "padel", true],
  ["padel-control", "Control Padel Racket", "padel", "Rackets", 8999, "padel"],
  ["padel-balls", "Padel Match Balls · 3", "padel", "Balls", 549, "ball"],
  ["padel-grips", "Padel Comfort Overgrips", "padel", "Grips", 399, "grip"],
  ["padel-protector", "Padel Frame Protector", "padel", "Accessories", 499, "grip"],
  ["padel-bag", "Panorama Padel Backpack", "padel", "Bags", 3499, "bag"],
  ["badminton-pro", "Featherlight 88 Badminton Racket", "badminton", "Rackets", 5999, "racket"],
  ["badminton-club", "Club Series Badminton Racket", "badminton", "Rackets", 2499, "racket"],
  ["feather-shuttle", "Tournament Feather Shuttlecocks · 12", "badminton", "Shuttlecocks", 1999, "shuttle"],
  ["nylon-shuttle", "Durable Nylon Shuttlecocks · 6", "badminton", "Shuttlecocks", 649, "shuttle"],
  ["badminton-string", "Repulsion 66 Badminton Strings", "badminton", "Strings", 499, "grip"],
  ["badminton-shoe", "Court Grip Indoor Shoes", "badminton", "Shoes", 4299, "shoe"],
  ["cricket-bat", "English Willow Match Bat", "cricket", "Bats", 8999, "bat", true],
  ["cricket-training", "Kashmir Willow Training Bat", "cricket", "Bats", 2999, "bat"],
  ["cricket-ball", "Red Leather Match Ball", "cricket", "Balls", 699, "ball"],
  ["cricket-gloves", "Pro Batting Gloves", "cricket", "Gloves", 1999, "glove"],
  ["cricket-pads", "Lightweight Batting Pads", "cricket", "Pads", 2499, "pad"],
  ["cricket-helmet", "Club Cricket Helmet", "cricket", "Helmets", 2999, "helmet"],
  ["cricket-kit", "Matchday Cricket Kit Bag", "cricket", "Bags", 3499, "bag"],
  ["club-tee", "Champions Performance Tee", "all", "Apparel", 1299, "shirt", true],
  ["club-polo", "Everyday Club Polo", "all", "Apparel", 1799, "shirt"],
  ["club-shorts", "Court Ready Training Shorts", "all", "Apparel", 1499, "shorts"],
  ["club-jacket", "Warm-Up Track Jacket", "all", "Apparel", 2999, "shirt"],
  ["club-socks", "Performance Crew Socks · 3", "all", "Accessories", 599, "sock"],
  ["club-towel", "Courtside Microfibre Towel", "all", "Accessories", 799, "towel"],
  ["club-bottle", "Champions Insulated Bottle", "all", "Accessories", 999, "bottle", true],
  ["club-cap", "Sun Court Performance Cap", "all", "Accessories", 699, "cap"],
  ["club-wrist", "Absorb Wristbands · 2", "all", "Accessories", 349, "grip"],
  ["club-duffel", "Weekend Sports Duffel", "all", "Bags", 2499, "bag"],
  ["club-rope", "Speed Training Jump Rope", "all", "Accessories", 499, "grip"],
];
const menus: [string, string, string, number, boolean][] = [
  ["avocado-toast", "Avocado on sourdough", "Breakfast", 320, true],
  ["omelette", "Three-egg club omelette", "Breakfast", 280, false],
  ["smoothie", "Berry recovery smoothie", "Drinks", 240, true],
  ["cold-coffee", "House cold coffee", "Drinks", 180, true],
  ["lemonade", "Fresh lime & mint", "Drinks", 140, true],
  ["salad", "Green bowl with grilled paneer", "Kitchen", 380, true],
  ["burger", "Club chicken burger", "Kitchen", 420, false],
  ["pasta", "Roasted tomato penne", "Kitchen", 360, true],
  ["sandwich", "Courtside grilled sandwich", "Kitchen", 260, true],
  ["fries", "Sea salt fries", "Small plates", 190, true],
  ["hummus", "Hummus & warm pita", "Small plates", 280, true],
  ["coffee", "Espresso / Americano", "Drinks", 120, true],
  ["beer", "Craft lager · 330 ml", "Bar", 350, true],
  ["mocktail", "Orange & rosemary cooler", "Bar", 260, true],
];
async function main() {
  await db.clubSettings.upsert({ where: { id: "club" }, create: { id: "club" }, update: {} });
  for (const [index, { rate, count, ...sport }] of sports.entries()) {
    await db.sport.upsert({ where: { id: sport.id }, create: { ...sport, sortOrder: index }, update: {} });
    for (let n = 1; n <= count; n++) {
      const id = `${sport.id}-${n}`;
      await db.court.upsert({ where: { id }, create: { id, sportId: sport.id, name: `${sport.name} ${sport.id === "cricket" ? "Net" : "Court"} ${n}`, hourlyPaise: rate, indoor: sport.id === "badminton" }, update: {} });
    }
  }
  for (const plan of plans) await db.membershipPlan.upsert({ where: { id: plan.id }, create: plan, update: {} });
  for (const [index, [id, name, sport, category, price, image, featured]] of catalogue.entries()) {
    await db.product.upsert({ where: { id }, create: { id, name, sport, category, description: `${name}. Selected for club players, with dependable performance for practice and match day. Collect at the Champions Shop.`, image: `/images/products/${image}.svg`, featured: !!featured }, update: {} });
    const labels = category === "Apparel" ? ["S", "M", "L", "XL"] : category === "Shoes" ? ["UK 7", "UK 8", "UK 9", "UK 10"] : category === "Rackets" && sport === "tennis" ? ["Grip 2", "Grip 3"] : ["Standard"];
    for (const [n, label] of labels.entries()) {
      const variantId = `${id}-${n}`;
      await db.productVariant.upsert({ where: { id: variantId }, create: { id: variantId, productId: id, sku: `CC-${id.toUpperCase()}-${n}`, label, pricePaise: price * 100, stock: 8 + (index * 7 + n) % 24 }, update: {} });
    }
  }
  for (const [id, name, category, price, vegetarian] of menus) await db.menuItem.upsert({ where: { id }, create: { id, name, category, pricePaise: price * 100, vegetarian, description: "Freshly prepared at your clubhouse.", available: id !== "omelette" }, update: {} });
  for (let n = 1; n <= 8; n++) await db.diningTable.upsert({ where: { id: `table-${n}` }, create: { id: `table-${n}`, name: `Table ${n}`, capacity: n < 5 ? 4 : 6 }, update: {} });
  const password = await hashPassword("Champions2026!");
  const users: [string, string, Role, string][] = [
    ["member", "Aarav Mehta", "MEMBER", "1994-04-12"], ["new", "Ananya Rao", "MEMBER", "1998-08-21"],
    ["junior", "Riya Shah", "MEMBER", "2011-06-15"], ["expired", "Karan Patel", "MEMBER", "1990-02-02"],
    ["owner", "Priya Sharma", "OWNER", "1985-05-09"], ["reception", "Neha Singh", "RECEPTION", "1995-03-10"],
    ["cashier", "Dev Kapoor", "CASHIER", "1996-12-20"], ["kitchen", "Kabir Khan", "KITCHEN", "1992-01-05"],
  ];
  for (const [slug, name, role, birth] of users) {
    const id = `demo-${slug}`;
    await db.user.upsert({ where: { id }, create: { id, name, email: `${slug}@champions.local`, emailVerified: true, role, championsId: `CC-DEMO-${slug.toUpperCase()}`, dateOfBirth: new Date(birth), phone: "+91 98765 43210" }, update: {} });
    await db.account.upsert({ where: { providerId_accountId: { providerId: "credential", accountId: id } }, create: { id: `account-${slug}`, accountId: id, providerId: "credential", userId: id, password }, update: {} });
  }
  if (!await db.membership.count({ where: { userId: "demo-member" } }) && process.env.PAYMENT_MODE === "local") await purchaseMembership("demo-member", "seed-gold", { planId: "gold", action: "purchase", acceptPolicy: true, planVersion: (await db.membershipPlan.findUniqueOrThrow({ where: { id: "gold" } })).updatedAt.toISOString() });
  if (!await db.membership.count({ where: { userId: "demo-expired" } })) await db.membership.create({ data: { userId: "demo-expired", planId: "silver", startsAt: new Date(Date.now() - 100 * 86400000), endsAt: new Date(Date.now() - 10 * 86400000), pricePaise: 650000, planSnapshot: { name: "Silver", durationDays: 90, courtDiscountBps: 1500, shopDiscountBps: 500, foodDiscountBps: 500, freeSessionsWeek: 0 } } });
  console.log("Seeded 4 sports, 11 courts, 3 plans, 36 products, 14 menu items and 8 demo accounts. Existing records preserved.");
}
main().finally(() => db.$disconnect());
