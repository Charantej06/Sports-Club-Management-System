# Champions Club · Test Users & Credentials

All test and staff accounts are pre-seeded in the database with the standard password:

```
Champions2026!
```

- **Login URL:** [`/login`](file:///login)
- **Staff Desk URL:** [`/staff`](file:///staff) (Accessible to `OWNER`, `RECEPTION`, `CASHIER`, `KITCHEN`)
- **Customer Portal:** [`/account`](file:///account) & [`/book`](file:///book)

---

## 1. Staff & Administration Accounts

Staff workspaces switch views automatically based on the authenticated employee role.

| Role | Email | Name | Champions ID | Title / Role Details |
| :--- | :--- | :--- | :--- | :--- |
| **OWNER** | `owner@champions.local` | Priya Sharma | `CC-DEMO-OWNER` | Club Owner (Full Access) |
| **OWNER** | `rajesh.owner@champions.local` | Rajesh Nambiar | `CC-OWN-RAJESH` | Managing Director & Co-Owner |
| **RECEPTION** | `reception@champions.local` | Neha Singh | `CC-DEMO-RECEPTION` | Reception associate (₹28,000/mo) |
| **RECEPTION** | `sunil.reception@champions.local` | Sunil Gavaskar | `CC-STF-SUNIL` | Front Desk & Court Supervisor (₹32,000/mo) |
| **RECEPTION** | `aditi.reception@champions.local` | Aditi Ashok | `CC-STF-ADITI` | Member Relations & Receptionist (₹29,000/mo) |
| **CASHIER** | `cashier@champions.local` | Dev Kapoor | `CC-DEMO-CASHIER` | Waiter / cashier (₹26,000/mo) |
| **CASHIER** | `manoj.cashier@champions.local` | Manoj Bajpayee | `CC-STF-MANOJ` | Senior POS Cashier (₹28,000/mo) |
| **CASHIER** | `kavita.cashier@champions.local` | Kavita Krishnan | `CC-STF-KAVITA` | Clubhouse Waiter & Cashier (₹25,000/mo) |
| **KITCHEN** | `kitchen@champions.local` | Kabir Khan | `CC-DEMO-KITCHEN` | Kitchen chef (₹35,000/mo) |
| **KITCHEN** | `sanjeev.kitchen@champions.local` | Sanjeev Kapoor | `CC-STF-SANJEEV` | Executive Chef (₹45,000/mo) |
| **KITCHEN** | `tarla.kitchen@champions.local` | Tarla Dalal | `CC-STF-TARLA` | Sous Chef & Pastry (₹34,000/mo) |

---

## 2. Club Members by Tier

Members receive automatic pricing discounts and free session allocations based on their active membership tier.

### 🥇 Gold Members
- **Benefits:** 25% court discount, 15% shop discount, 15% clubhouse food discount, 2 free sessions/week.
- **Term:** 90 days (Quarterly ₹12,000).

| Email | Name | Champions ID | Phone | Status |
| :--- | :--- | :--- | :--- | :--- |
| `member@champions.local` | Aarav Mehta | `CC-DEMO-MEMBER` | `+91 98765 43210` | Active |
| `vikram.malhotra@champions.local` | Vikram Malhotra | `CC-GOLD-VIKRAM` | `+91 98111 22334` | Active |
| `sanya.mirza@champions.local` | Sanya Mirza | `CC-GOLD-SANYA` | `+91 98222 33445` | Active |
| `rohit.verma@champions.local` | Rohit Verma | `CC-GOLD-ROHIT` | `+91 98333 44556` | Active |

---

### 🥈 Silver Members
- **Benefits:** 15% court discount, 5% shop discount, 5% clubhouse food discount, 0 free sessions.
- **Term:** 90 days (Quarterly ₹6,500).

| Email | Name | Champions ID | Phone | Status |
| :--- | :--- | :--- | :--- | :--- |
| `meera.nair@champions.local` | Meera Nair | `CC-SILV-MEERA` | `+91 98444 55667` | Active |
| `rahul.dravid@champions.local` | Rahul Dravid | `CC-SILV-RAHUL` | `+91 98555 66778` | Active |
| `pooja.hegde@champions.local` | Pooja Hegde | `CC-SILV-POOJA` | `+91 98666 77889` | Active |

---

### 🥉 Junior Members (Under 18)
- **Benefits:** 20% court discount, 10% shop discount, 10% clubhouse food discount, 1 free session/week.
- **Eligibility:** Age under 18 verified via date of birth.

| Email | Name | Champions ID | DOB | Status |
| :--- | :--- | :--- | :--- | :--- |
| `junior@champions.local` | Riya Shah | `CC-DEMO-JUNIOR` | `2011-06-15` | Active |
| `arjun.tendulkar@champions.local` | Arjun Tendulkar | `CC-JUN-ARJUN` | `2010-04-18` | Active |
| `zoya.akhtar@champions.local` | Zoya Akhtar | `CC-JUN-ZOYA` | `2011-08-30` | Active |

---

### ⏳ Expired Memberships (Testing Renewals)
- **Scenario:** Previous members whose quarterly terms expired. Useful for testing renew prompts and standard non-member pricing fallback.

| Email | Name | Champions ID | Previous Tier | Expiration |
| :--- | :--- | :--- | :--- | :--- |
| `expired@champions.local` | Karan Patel | `CC-DEMO-EXPIRED` | Silver | Expired |
| `deepak.chahar@champions.local` | Deepak Chahar | `CC-EXP-DEEPAK` | Gold | Expired |
| `ishaan.kishan@champions.local` | Ishaan Kishan | `CC-EXP-ISHAAN` | Silver | Expired |

---

### 🎾 New Guests & Non-Members
- **Scenario:** Registered accounts without an active membership subscription. Books at standard non-member rates.

| Email | Name | Champions ID | Phone |
| :--- | :--- | :--- | :--- |
| `new@champions.local` | Ananya Rao | `CC-DEMO-NEW` | `+91 98765 43211` |
| `tanvi.sharma@champions.local` | Tanvi Sharma | `CC-NEW-TANVI` | `+91 97111 11223` |
| `siddharth.roy@champions.local` | Siddharth Roy | `CC-NEW-SID` | `+91 97222 22334` |

---

## 3. Quick Testing Tips

1. **Member Lookup / QR Verification**:
   - In Reception or Club Desk, search by Champions ID (e.g. `CC-GOLD-VIKRAM`) or email.
   - For camera/scanner testing, member card tokens follow `card-token-${userId}`.
2. **Court Booking Discounts**:
   - Log in as a Gold member (`vikram.malhotra@champions.local`) and navigate to [`/book`](file:///book). Notice the 25% discount applied at checkout.
   - Compare with a Non-member (`tanvi.sharma@champions.local`) to observe the standard court rates.
3. **Staff Court Schedule & Add Court**:
   - Log in as Reception (`sunil.reception@champions.local`) or Owner (`owner@champions.local`).
   - Navigate to [`/staff`](file:///staff) and click **Courts & slots**.
   - Inspect booked vs. available slots, filter by sport, or click **Add new court** to create a new court in the database.
