import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { productImage } from "../src/modules/shop/product-images";
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
const menus: [string, string, string, number, boolean, string][] = [
  ["avocado-toast", "Avocado on sourdough", "Breakfast", 320, true, "clubhouse/menu/avocado-toast.jpg"],
  ["omelette", "Three-egg club omelette", "Breakfast", 280, false, "clubhouse/menu/omelette.jpg"],
  ["smoothie", "Berry recovery smoothie", "Drinks", 240, true, "clubhouse/menu/smoothie.jpg"],
  ["cold-coffee", "House cold coffee", "Drinks", 180, true, "clubhouse/menu/cold-coffee.jpg"],
  ["lemonade", "Fresh lime & mint", "Drinks", 140, true, "clubhouse/menu/smoothie.jpg"],
  ["salad", "Green bowl with grilled paneer", "Kitchen", 380, true, "clubhouse/menu/salad.jpg"],
  ["burger", "Club chicken burger", "Kitchen", 420, false, "clubhouse/menu/burger.jpg"],
  ["pasta", "Roasted tomato penne", "Kitchen", 360, true, "clubhouse/menu/pasta.jpg"],
  ["sandwich", "Courtside grilled sandwich", "Kitchen", 260, true, "clubhouse/menu/sandwich.jpg"],
  ["fries", "Sea salt fries", "Small plates", 190, true, "clubhouse/menu/fries.jpg"],
  ["hummus", "Hummus & warm pita", "Small plates", 280, true, "clubhouse/menu/hummus.jpg"],
  ["coffee", "Espresso / Americano", "Drinks", 120, true, "clubhouse/menu/coffee.jpg"],
  ["beer", "Craft lager · 330 ml", "Bar", 350, true, "clubhouse/menu/cold-coffee.jpg"],
  ["mocktail", "Orange & rosemary cooler", "Bar", 260, true, "clubhouse/menu/smoothie.jpg"],
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
    await db.product.upsert({ where: { id }, create: { id, name, sport, category, description: `${name}. Selected for club players, with dependable performance for practice and match day. Collect at the Champions Shop.`, image: productImage(id, `/images/products/${image}.svg`), featured: !!featured }, update: {} });
    const labels = category === "Apparel" ? ["S", "M", "L", "XL"] : category === "Shoes" ? ["UK 7", "UK 8", "UK 9", "UK 10"] : category === "Rackets" && sport === "tennis" ? ["Grip 2", "Grip 3"] : ["Standard"];
    for (const [n, label] of labels.entries()) {
      const variantId = `${id}-${n}`;
      await db.productVariant.upsert({ where: { id: variantId }, create: { id: variantId, productId: id, sku: `CC-${id.toUpperCase()}-${n}`, label, pricePaise: price * 100, stock: 8 + (index * 7 + n) % 24 }, update: {} });
    }
  }
  for (const [id, name, category, price, vegetarian, image] of menus) await db.menuItem.upsert({ where: { id }, create: { id, name, category, pricePaise: price * 100, vegetarian, description: "Freshly prepared at your clubhouse.", available: id !== "omelette", image: `/images/${image}` }, update: { image: `/images/${image}` } });
  for (let n = 1; n <= 8; n++) await db.diningTable.upsert({ where: { id: `table-${n}` }, create: { id: `table-${n}`, name: `Table ${n}`, capacity: n < 5 ? 4 : 6 }, update: {} });
  const password = await hashPassword("Champions2026!");

  type SeedUser = {
    id: string;
    name: string;
    email: string;
    role: Role;
    championsId: string;
    birth: string;
    phone: string;
    tier?: "gold" | "silver" | "junior" | "expired-gold" | "expired-silver";
    employee?: { title: string; salaryPaise: number };
  };

  const seedUsers: SeedUser[] = [
    // --- Demo Base Accounts ---
    { id: "demo-member", name: "Aarav Mehta", email: "member@champions.local", role: "MEMBER", championsId: "CC-DEMO-MEMBER", birth: "1994-04-12", phone: "+91 98765 43210", tier: "gold" },
    { id: "demo-new", name: "Ananya Rao", email: "new@champions.local", role: "MEMBER", championsId: "CC-DEMO-NEW", birth: "1998-08-21", phone: "+91 98765 43211" },
    { id: "demo-junior", name: "Riya Shah", email: "junior@champions.local", role: "MEMBER", championsId: "CC-DEMO-JUNIOR", birth: "2011-06-15", phone: "+91 98765 43212", tier: "junior" },
    { id: "demo-expired", name: "Karan Patel", email: "expired@champions.local", role: "MEMBER", championsId: "CC-DEMO-EXPIRED", birth: "1990-02-02", phone: "+91 98765 43213", tier: "expired-silver" },
    { id: "demo-owner", name: "Priya Sharma", email: "owner@champions.local", role: "OWNER", championsId: "CC-DEMO-OWNER", birth: "1985-05-09", phone: "+91 98765 43214" },
    { id: "demo-reception", name: "Neha Singh", email: "reception@champions.local", role: "RECEPTION", championsId: "CC-DEMO-RECEPTION", birth: "1995-03-10", phone: "+91 98765 43215", employee: { title: "Reception associate", salaryPaise: 2800000 } },
    { id: "demo-cashier", name: "Dev Kapoor", email: "cashier@champions.local", role: "CASHIER", championsId: "CC-DEMO-CASHIER", birth: "1996-12-20", phone: "+91 98765 43216", employee: { title: "Waiter / cashier", salaryPaise: 2600000 } },
    { id: "demo-kitchen", name: "Kabir Khan", email: "kitchen@champions.local", role: "KITCHEN", championsId: "CC-DEMO-KITCHEN", birth: "1992-01-05", phone: "+91 98765 43217", employee: { title: "Kitchen chef", salaryPaise: 3500000 } },

    // --- Gold Tier Members ---
    { id: "user-gold-vikram", name: "Vikram Malhotra", email: "vikram.malhotra@champions.local", role: "MEMBER", championsId: "CC-GOLD-VIKRAM", birth: "1991-03-15", phone: "+91 98111 22334", tier: "gold" },
    { id: "user-gold-sanya", name: "Sanya Mirza", email: "sanya.mirza@champions.local", role: "MEMBER", championsId: "CC-GOLD-SANYA", birth: "1989-11-20", phone: "+91 98222 33445", tier: "gold" },
    { id: "user-gold-rohit", name: "Rohit Verma", email: "rohit.verma@champions.local", role: "MEMBER", championsId: "CC-GOLD-ROHIT", birth: "1993-07-08", phone: "+91 98333 44556", tier: "gold" },

    // --- Silver Tier Members ---
    { id: "user-silver-meera", name: "Meera Nair", email: "meera.nair@champions.local", role: "MEMBER", championsId: "CC-SILV-MEERA", birth: "1996-05-14", phone: "+91 98444 55667", tier: "silver" },
    { id: "user-silver-rahul", name: "Rahul Dravid", email: "rahul.dravid@champions.local", role: "MEMBER", championsId: "CC-SILV-RAHUL", birth: "1992-09-25", phone: "+91 98555 66778", tier: "silver" },
    { id: "user-silver-pooja", name: "Pooja Hegde", email: "pooja.hegde@champions.local", role: "MEMBER", championsId: "CC-SILV-POOJA", birth: "1995-12-02", phone: "+91 98666 77889", tier: "silver" },

    // --- Junior Tier Members (<18) ---
    { id: "user-jun-arjun", name: "Arjun Tendulkar", email: "arjun.tendulkar@champions.local", role: "MEMBER", championsId: "CC-JUN-ARJUN", birth: "2010-04-18", phone: "+91 98777 88990", tier: "junior" },
    { id: "user-jun-zoya", name: "Zoya Akhtar", email: "zoya.akhtar@champions.local", role: "MEMBER", championsId: "CC-JUN-ZOYA", birth: "2011-08-30", phone: "+91 98888 99001", tier: "junior" },

    // --- Expired Members ---
    { id: "user-exp-deepak", name: "Deepak Chahar", email: "deepak.chahar@champions.local", role: "MEMBER", championsId: "CC-EXP-DEEPAK", birth: "1990-06-10", phone: "+91 98999 00112", tier: "expired-gold" },
    { id: "user-exp-ishaan", name: "Ishaan Kishan", email: "ishaan.kishan@champions.local", role: "MEMBER", championsId: "CC-EXP-ISHAAN", birth: "1994-08-14", phone: "+91 98999 11223", tier: "expired-silver" },

    // --- New / Guest Non-Members ---
    { id: "user-new-tanvi", name: "Tanvi Sharma", email: "tanvi.sharma@champions.local", role: "MEMBER", championsId: "CC-NEW-TANVI", birth: "1999-01-22", phone: "+91 97111 11223" },
    { id: "user-new-sid", name: "Siddharth Roy", email: "siddharth.roy@champions.local", role: "MEMBER", championsId: "CC-NEW-SID", birth: "1997-10-11", phone: "+91 97222 22334" },

    // --- Additional Cashiers / POS Staff ---
    { id: "staff-cash-manoj", name: "Manoj Bajpayee", email: "manoj.cashier@champions.local", role: "CASHIER", championsId: "CC-STF-MANOJ", birth: "1988-04-23", phone: "+91 97333 33445", employee: { title: "Senior POS Cashier", salaryPaise: 2800000 } },
    { id: "staff-cash-kavita", name: "Kavita Krishnan", email: "kavita.cashier@champions.local", role: "CASHIER", championsId: "CC-STF-KAVITA", birth: "1994-02-17", phone: "+91 97444 44556", employee: { title: "Clubhouse Waiter & Cashier", salaryPaise: 2500000 } },

    // --- Additional Reception Staff ---
    { id: "staff-rec-sunil", name: "Sunil Gavaskar", email: "sunil.reception@champions.local", role: "RECEPTION", championsId: "CC-STF-SUNIL", birth: "1987-07-10", phone: "+91 97555 55667", employee: { title: "Front Desk & Court Supervisor", salaryPaise: 3200000 } },
    { id: "staff-rec-aditi", name: "Aditi Ashok", email: "aditi.reception@champions.local", role: "RECEPTION", championsId: "CC-STF-ADITI", birth: "1993-03-29", phone: "+91 97666 66778", employee: { title: "Member Relations & Receptionist", salaryPaise: 2900000 } },

    // --- Additional Kitchen Staff ---
    { id: "staff-kit-sanjeev", name: "Sanjeev Kapoor", email: "sanjeev.kitchen@champions.local", role: "KITCHEN", championsId: "CC-STF-SANJEEV", birth: "1982-04-10", phone: "+91 97777 77889", employee: { title: "Executive Chef", salaryPaise: 4500000 } },
    { id: "staff-kit-tarla", name: "Tarla Dalal", email: "tarla.kitchen@champions.local", role: "KITCHEN", championsId: "CC-STF-TARLA", birth: "1986-06-08", phone: "+91 97888 88990", employee: { title: "Sous Chef & Pastry", salaryPaise: 3400000 } },

    // --- Additional Owners ---
    { id: "staff-own-rajesh", name: "Rajesh Nambiar", email: "rajesh.owner@champions.local", role: "OWNER", championsId: "CC-OWN-RAJESH", birth: "1980-01-15", phone: "+91 99000 11223" },
  ];

  const planSnapshots = {
    gold: { name: "Gold", durationDays: 90, courtDiscountBps: 2500, shopDiscountBps: 1500, foodDiscountBps: 1500, freeSessionsWeek: 2, pricePaise: 1200000 },
    silver: { name: "Silver", durationDays: 90, courtDiscountBps: 1500, shopDiscountBps: 500, foodDiscountBps: 500, freeSessionsWeek: 0, pricePaise: 650000 },
    junior: { name: "Junior", durationDays: 90, courtDiscountBps: 2000, shopDiscountBps: 1000, foodDiscountBps: 1000, freeSessionsWeek: 1, pricePaise: 350000 },
  };

  for (const u of seedUsers) {
    await db.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role,
        championsId: u.championsId,
        dateOfBirth: new Date(u.birth),
        phone: u.phone,
      },
      update: {
        name: u.name,
        email: u.email,
        role: u.role,
        championsId: u.championsId,
        dateOfBirth: new Date(u.birth),
        phone: u.phone,
      },
    });

    await db.account.upsert({
      where: { providerId_accountId: { providerId: "credential", accountId: u.id } },
      create: { id: `account-${u.id}`, accountId: u.id, providerId: "credential", userId: u.id, password },
      update: { password },
    });

    // Create member QR identification card
    if (u.role === "MEMBER") {
      await db.memberCard.upsert({
        where: { userId: u.id },
        create: {
          id: `card-${u.id}`,
          userId: u.id,
          token: `card-token-${u.id}`,
          issuedAt: new Date(),
        },
        update: {},
      });
    }

    // Create employee record for staff
    if (u.employee) {
      await db.employee.upsert({
        where: { userId: u.id },
        create: {
          userId: u.id,
          title: u.employee.title,
          salaryPaise: u.employee.salaryPaise,
          active: true,
        },
        update: {
          title: u.employee.title,
          salaryPaise: u.employee.salaryPaise,
          active: true,
        },
      });
    }

    // Create active or expired membership
    if (u.tier) {
      const isExpired = u.tier.startsWith("expired-");
      const basePlanId = (isExpired ? u.tier.replace("expired-", "") : u.tier) as "gold" | "silver" | "junior";
      const snapshot = planSnapshots[basePlanId];

      const startsAt = isExpired
        ? new Date(Date.now() - 100 * 86400000)
        : new Date(Date.now() - 15 * 86400000);
      const endsAt = isExpired
        ? new Date(Date.now() - 10 * 86400000)
        : new Date(Date.now() + 75 * 86400000);

      const existingMembership = await db.membership.findFirst({
        where: { userId: u.id },
      });

      if (!existingMembership) {
        await db.membership.create({
          data: {
            userId: u.id,
            planId: basePlanId,
            startsAt,
            endsAt,
            status: "ACTIVE",
            planSnapshot: snapshot,
            pricePaise: snapshot.pricePaise,
          },
        });
      }
    }
  }

  console.log(`Seeded 4 sports, 11 courts, 3 plans, 36 products, 14 menu items, and ${seedUsers.length} users with comprehensive membership tiers and staff roles.`);
}
main().finally(() => db.$disconnect());
