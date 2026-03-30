# Mashinchi — User Flow، صفحات UI، MVP دقیق

این سند **مرجع تک‌منبع** برای پیاده‌سازی فرانت (Next.js App Router)، بک‌اند (NestJS) و پنل ادمین است تا Cursor/تیم بدون ابهام همان مسیر را بسازند.

---

## 1) User journey (مسیر اصلی)

```
Home
 → Start Car Assistant (CTA)
 → Wizard (چند مرحله)
 → ذخیرهٔ پروفایل کاربر (User + preferences + usageTags)
 → Suggested Cars (/assistant/results یا /suggested)
 → (اختیاری) Compare Cars
 → Car Detail
 → Market & Price (همان دیتیلی یا /market?carId=)
 → Wishlist / Save
 → تصمیم نهایی (خارج از سیستم یا bookmark)
```

**هسته محصول:** ویزارد + موتور پیشنهاد + صفحهٔ نتایج + جزئیات خودرو + مقایسه.

---

## 2) نگاشت صفحات MVP → مسیر Next.js (`app/`)

| # | صفحه | مسیر پیشنهادی | یادداشت کوتاه |
|---|------|----------------|---------------|
| 1 | Home | `/` | Hero، جستجو، بلوک‌های Best by budget/family/economic/investment، Popular، CTA ویزارد |
| 2 | Car Assistant Wizard | `/assistant` | مرحله‌به‌مرحله؛ خروجی: redirect به نتایج با `userId` یا session |
| 3 | Suggested Cars | `/assistant/results` | نتایج ویزارد؛ query: `?userId=` یا state موقت |
| 4 | Car Detail | `/cars/[id]` | تمام سکشن‌های دیتیل (پایین) |
| 5 | Compare Cars | `/compare` | query: `?a=&b=` یا انتخاب از UI |
| 6 | Cars List | `/cars` | فیلتر + مرتب‌سازی |
| 7 | Price Chart | `/cars/[id]` (تاب) **یا** `/cars/[id]/price` | MVP: تب داخل دیتیل کافی است |
| 8 | Market Page | `/market` | نمای کلی بازار + **یا** ` /market?carId=` برای تمرکز روی یک مدل |
| 9 | Wishlist | `/wishlist` | نیاز به شناسهٔ کاربر (auth جلسه‌ای یا MVP: `localStorage` + sync بعدی) |
| 10 | Admin | `/admin` | زیرمسیرها: `/admin/cars`, `/admin/cars/[id]`, … |

---

## 3) Home — سکشن‌ها (ترتیب پیشنهادی)

1. **Hero:** عنوان نمونه: «با بودجه‌ات بهترین ماشین را انتخاب کن.»
2. **CTAها:** `شروع دستیار` → `/assistant`، `مقایسه` → `/compare`، `بهترین‌ها با بودجه` → anchor یا `/cars?sort=score&preset=budget`
3. **جستجو:** ورودی متنی → لیست `/cars?q=…`
4. **Popular Cars:** کارت افقی/گرید (از API: `adsCount` یا `overallScore` — قرارداد API)
5. **Best Family / Economic / Investment:** هرکدام preset فیلتر + لینک «مشاهدهٔ همه»
6. **Latest Price Changes:** از `priceChange30d` یا diff آخرین `PriceHistory`

---

## 4) Car Assistant Wizard — مراحل و دادهٔ خروجی

### Step 1 — Budget & tenure

- بودجه (عدد، تومان)
- نوع: صفر / کارکرده / فرقی ندارد → `User.listingCondition`
- چند سال نگه می‌دارم → `User.holdYears`

### Step 2 — Usage (چندتایی)

گزینه‌ها: شهری، خانوادگی، سفر، اسپرت، آفرود، کار (اسنپ)، سرمایه‌گذاری  
→ ذخیره در `User.usageTags[]` (enum `UsageType` در Prisma)

### Step 3 — Priorities (اسلایدر 0–100)

ابعاد (نام‌ها با API یکسان):

- مصرف سوخت → وزن `economy`
- شتاب/دینامیک → `performance`
- راحتی → `comfort`
- هزینه نگهداری → `ownership`
- بازار دست دوم / نقدشوندگی → `market`
- افت قیمت → ترکیب با `market` یا فیلد مجزا در `preferences` (توافق تیم)
- آپشن → داخل `comfort` یا `preferences.optionWeight`
- پرستیژ → `prestige`
- استهلاک → نزدیک `ownership` / `reliability`

**خروجی:** آبجکت نرمال‌شده در `User.preferences.weights` مثلاً:

```json
{
  "weights": {
    "performance": 0.15,
    "comfort": 0.12,
    "economy": 0.14,
    "reliability": 0.14,
    "market": 0.12,
    "ownership": 0.12,
    "prestige": 0.11,
    "risk": 0.10
  }
}
```

مجموع وزن‌های مثبت باید ۱ شود؛ `risk` در فرمول کم‌شونده است.

### Step 4 — Risk

کم / متوسط / زیاد → `User.riskLevel`

### Step 5 — Previous cars

چند انتخاب از autocomplete خودروهای موجود → `User.previousCarIds[]`

### Step 6 — Result

- `POST` پروفایل به API → `userId`
- redirect: `/assistant/results?userId=…`

---

## 5) Suggested Cars — هر کارت

فیلدهای UI:

- نام برند/مدل، سال، تصویر
- **Final / Overall score** (از recommendation یا `CarScores.overallScore`)
- **Price range** از `CarMarketData.minPrice`–`maxPrice` یا `avgPrice`
- **Market:** برچسب از `liquidityScore` / `marketScore` (خوب / متوسط / ضعیف)
- **Maintenance:** از `ownershipScore` یا فیلد آتی `maintenance_band` — MVP: دستهٔ متنی از ادمین یا derivation ساده
- **Pros / Cons** (چند خط از `Car.pros` / `Car.cons`)
- دکمه‌ها: `Compare`، `جزئیات`

---

## 6) Car Detail — سکشن‌ها (ترتیب)

1. Overview (عکس، نام، سال، بخش)
2. قیمت (میانگین / بازه) + روند کوتاه
3. **Price chart** (Recharts از `PriceHistory`)
4. Pros & Cons
5. Radar یا جدول **Scores** (۸ بعد + overall)
6. Market analysis (آگهی، نقدشوندگی، تغییر قیمت)
7. Reliability (از `reliabilityScore` + متن ادمین در صورت وجود)
8. Maintenance cost (ownership / متن)
9. User reviews summary ( aggregates از `car_feature_scores` یا متن خلاصه MVP)
10. Blogger / منابع (لینک یا embed بعدی)
11. Ads count / لینک خارجی Divar/Bama — **فقط لینک/شمارش MVP**
12. Compare with competitors (۳–۵ خودرو هم‌سگمنت از API)
13. Suitable for whom (متن یا tag از `usageTags`↔segment)
14. Risk analysis (risk score + توضیح کوتاه)

---

## 7) Compare Cars

- جدول: ابعاد Score برای دو خودرو (و در آینده N خودرو)
- ردیف **Overall**
- زیر جدول: برنده در Economic, Family, Sport, City, Trip, Investment (در DB `Comparison` یا محاسبهٔ زنده از scores + usage preset)

---

## 8) Cars List — فیلتر و مرتب‌سازی

**فilters (MVP):**

- قیمت (بازه)
- بدنه (`bodyType`)
- سوخت (`CarSpecs.fuelType`)
- دنده (`CarSpecs.transmission`)
- پیش‌تنظیمات: family / economic / low maintenance / high resale / min score

**Sort:**

- best score (`overall_score`)
- cheapest (`avgPrice`)
- popular (`adsCount`)
- lowest depreciation (`priceChange1y` صعودی اگر منفی بهتر است — قرارداد)
- best market (`liquidityScore` یا `marketScore`)

---

## 9) Market Page — MVP

- نمودار قیمت / تعداد آگهی (aggregate یا per car انتخابی)
- تغییر قیمت ۳۰روز / ۱سال
- liquidity
- فاز بعد: شهر، کارکرد میانگین، روند بازار

---

## 10) Admin Panel — CRUD حداقلی (بدون آن MVP گیر می‌کند)

زیرصفحات:

- `/admin/cars` — لیست، ایجاد
- `/admin/cars/[id]` — ویرایش Car + pros/cons
- تب‌ها یا زیرمسیر: specs، scores، market snapshot، import price history (CSV دستی OK برای MVP)
- `/admin/reviews` — paste متن خام → `car_reviews_raw`
- `/admin/comparisons` — مدیریت دستی برنده‌ها (اختیاری MVP)

**Auth ادمین:** حداقل HTTP Basic یا یک نقش در JWT — در فاز ۱ قفل ساده.

---

## 11) MVP چک‌لیست نهایی (قابل تیک زدن)

1. دیتابیس خودرو + specs + scores + market + price_history  
2. API لیست/جزئیات/مقایسه/پیشنهاد  
3. صفحهٔ دیتیل کامل (طبق سکشن‌ها)  
4. compare دو ماشین  
5. فیلتر بودجه در `/cars` و preset homepage  
6. `/assistant` + `/assistant/results`  
7. نمودار قیمت (Recharts)  
8. دادهٔ بازار پایه روی دیتیل و `/market`  
9. wishlist (حتی local اول)  
10. admin بارگذاری داده  

---

## 12) ساختار فولدر بک‌اند (NestJS)

```
src/
  modules/
    cars/
    specs/
    scores/
    market/
    price-history/
    comparisons/
    users/
    recommendations/
    reviews/
  jobs/          // BullMQ بعدی
  common/        // guards, pipes, prisma
```

---

## 13) ساختار فولدر فرانت (Next.js)

```
app/
  page.tsx                 # Home
  cars/
    page.tsx               # List
    [id]/
      page.tsx             # Detail (+ tabs chart)
  compare/
    page.tsx
  assistant/
    page.tsx               # Wizard
    results/
      page.tsx
  market/
    page.tsx
  wishlist/
    page.tsx
  admin/
    layout.tsx
    page.tsx
    cars/
      ...
components/
  car/
  charts/
  filters/
  wizard/
  layout/
lib/
  api.ts                   # fetcher / react-query keys
```

---

## 14) هفت هستهٔ سیستم (اولویت پیاده‌سازی)

1. Car database  
2. Car score model  
3. Market data  
4. Price history  
5. Comparison engine (جدول + برنده per usage)  
6. Recommendation engine (وزن از ویزارد)  
7. User profiling wizard  

اگر این هفت مورد پایدار باشد، بقیهٔ UI صرفاً مصرف‌کنندهٔ API است.
