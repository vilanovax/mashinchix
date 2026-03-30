import 'dotenv/config';
import {
  Prisma,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

type CarSeedRow = {
  brand: string;
  model: string;
  year: number;
  bodyType: string;
  segment: string;
  image: string | null;
  pros: string[];
  cons: string[];
  specs: {
    engine: string;
    horsepower: number;
    torque: string;
    gearbox: string;
    transmission: string;
    fuelType: string;
    fuelConsumption: string;
    acceleration: string;
    maxSpeed: number;
    weight: number;
    trunk: number;
  };
  market: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    adsCount: number;
    priceChange30d: number;
    priceChange1y: number;
    liquidityScore: number;
  };
  scores: {
    performanceScore: number;
    comfortScore: number;
    economyScore: number;
    reliabilityScore: number;
    marketScore: number;
    ownershipScore: number;
    prestigeScore: number;
    riskScore: number;
    overallScore: number;
  };
  priceBase: number;
};

const CARS: CarSeedRow[] = [
  {
    brand: 'ایران‌خودرو',
    model: 'پژو ۲۰۶ تیپ ۵',
    year: 1398,
    bodyType: 'هاچ‌بک',
    segment: 'اقتصادی',
    image: null,
    pros: ['قطعات ارزان', 'جای پارک آسان', 'مصرف نسبتاً منطقی'],
    cons: ['صفحات لرزش بدنه', 'قدیمی بودن پلتفرم'],
    specs: {
      engine: 'TU5 1.6L',
      horsepower: 105,
      torque: '143 Nm',
      gearbox: 'دستی ۵ سرعته',
      transmission: 'manual',
      fuelType: 'gasoline',
      fuelConsumption: '۷.۵ لیتر',
      acceleration: '۰–۱۰۰: حدود ۱۱s',
      maxSpeed: 185,
      weight: 1050,
      trunk: 284,
    },
    market: {
      avgPrice: 1_250_000_000,
      minPrice: 1_100_000_000,
      maxPrice: 1_400_000_000,
      adsCount: 942,
      priceChange30d: -0.012,
      priceChange1y: -0.08,
      liquidityScore: 88,
    },
    scores: {
      performanceScore: 52,
      comfortScore: 48,
      economyScore: 78,
      reliabilityScore: 62,
      marketScore: 90,
      ownershipScore: 82,
      prestigeScore: 40,
      riskScore: 35,
      overallScore: 64,
    },
    priceBase: 1_250_000_000,
  },
  {
    brand: 'ایران‌خودرو',
    model: 'پژو پارس',
    year: 1399,
    bodyType: 'سدان',
    segment: 'خانوادگی',
    image: null,
    pros: ['فضای عقب مناسب', 'خدمات پس از فروش گسترده'],
    cons: ['مصرف بالاتر از هاچ‌بک‌های کوچک', 'طراحی قدیمی'],
    specs: {
      engine: 'XU7 1761cc',
      horsepower: 100,
      torque: '153 Nm',
      gearbox: 'دستی ۵ سرعته',
      transmission: 'manual',
      fuelType: 'gasoline',
      fuelConsumption: '۹ لیتر',
      acceleration: '۰–۱۰۰: حدود ۱۳s',
      maxSpeed: 175,
      weight: 1165,
      trunk: 510,
    },
    market: {
      avgPrice: 1_480_000_000,
      minPrice: 1_320_000_000,
      maxPrice: 1_650_000_000,
      adsCount: 715,
      priceChange30d: -0.009,
      priceChange1y: -0.06,
      liquidityScore: 85,
    },
    scores: {
      performanceScore: 50,
      comfortScore: 58,
      economyScore: 62,
      reliabilityScore: 65,
      marketScore: 86,
      ownershipScore: 72,
      prestigeScore: 45,
      riskScore: 32,
      overallScore: 63,
    },
    priceBase: 1_480_000_000,
  },
  {
    brand: 'سایپا',
    model: 'شاهین G',
    year: 1400,
    bodyType: 'سدان',
    segment: 'خانوادگی',
    image: null,
    pros: ['ایمنی بهتر نسبت به محصولات قبلی سایپا', 'آپشن‌های نسبتاً خوب'],
    cons: ['قیمت بازار پر نوسان', 'نقدشوندگی در حال تثبیت'],
    specs: {
      engine: 'M15 1.5L',
      horsepower: 110,
      torque: '144 Nm',
      gearbox: 'AT ۶ سرعته',
      transmission: 'automatic',
      fuelType: 'gasoline',
      fuelConsumption: '۸ لیتر',
      acceleration: '۰–۱۰۰: حدود ۱۱.۵s',
      maxSpeed: 190,
      weight: 1240,
      trunk: 550,
    },
    market: {
      avgPrice: 1_950_000_000,
      minPrice: 1_780_000_000,
      maxPrice: 2_150_000_000,
      adsCount: 428,
      priceChange30d: 0.006,
      priceChange1y: 0.04,
      liquidityScore: 74,
    },
    scores: {
      performanceScore: 58,
      comfortScore: 65,
      economyScore: 64,
      reliabilityScore: 60,
      marketScore: 72,
      ownershipScore: 65,
      prestigeScore: 50,
      riskScore: 48,
      overallScore: 62,
    },
    priceBase: 1_950_000_000,
  },
  {
    brand: 'ایران‌خودرو',
    model: 'دنا پلاس توربو',
    year: 1400,
    bodyType: 'سدان',
    segment: 'میان‌رده',
    image: null,
    pros: ['شتاب خوب', 'کابین نسبتاً راحت'],
    cons: ['هزینه سرویس بالاتر', 'حساسیت بیشتر پیشرانه توربو'],
    specs: {
      engine: 'EF7 TC 1.7L Turbo',
      horsepower: 150,
      torque: '240 Nm',
      gearbox: 'DCT ۶ سرعته',
      transmission: 'automatic',
      fuelType: 'gasoline',
      fuelConsumption: '۸.۵ لیتر',
      acceleration: '۰–۱۰۰: حدود ۹.۵s',
      maxSpeed: 210,
      weight: 1320,
      trunk: 520,
    },
    market: {
      avgPrice: 2_350_000_000,
      minPrice: 2_100_000_000,
      maxPrice: 2_600_000_000,
      adsCount: 356,
      priceChange30d: 0.003,
      priceChange1y: 0.02,
      liquidityScore: 70,
    },
    scores: {
      performanceScore: 72,
      comfortScore: 68,
      economyScore: 58,
      reliabilityScore: 62,
      marketScore: 68,
      ownershipScore: 58,
      prestigeScore: 58,
      riskScore: 45,
      overallScore: 64,
    },
    priceBase: 2_350_000_000,
  },
  {
    brand: 'ایران‌خودرو',
    model: 'تارا اتوماتیک',
    year: 1401,
    bodyType: 'سدان',
    segment: 'میان‌رده',
    image: null,
    pros: ['کيفیت مونتاژ بهتر نسبت به محصولات قدیمی‌تر', 'پیشرانهٔ EF۷ پایدارتر'],
    cons: ['قیمت بالا در بازار آزاد', 'زمان تحویل و نوسان'],
    specs: {
      engine: 'EF7 1.7L',
      horsepower: 113,
      torque: '175 Nm',
      gearbox: 'AT ۶ سرعته',
      transmission: 'automatic',
      fuelType: 'gasoline',
      fuelConsumption: '۸.۲ لیتر',
      acceleration: '۰–۱۰۰: حدود ۱۱s',
      maxSpeed: 195,
      weight: 1295,
      trunk: 530,
    },
    market: {
      avgPrice: 2_550_000_000,
      minPrice: 2_350_000_000,
      maxPrice: 2_800_000_000,
      adsCount: 298,
      priceChange30d: 0.004,
      priceChange1y: 0.035,
      liquidityScore: 68,
    },
    scores: {
      performanceScore: 62,
      comfortScore: 70,
      economyScore: 60,
      reliabilityScore: 68,
      marketScore: 66,
      ownershipScore: 60,
      prestigeScore: 55,
      riskScore: 42,
      overallScore: 63,
    },
    priceBase: 2_550_000_000,
  },
  {
    brand: 'سایپا',
    model: 'کوییک S',
    year: 1400,
    bodyType: 'کراس‌اوور شهری',
    segment: 'شهری',
    image: null,
    pros: ['ارتفاع بدنه و دید خوب', 'مناسب ترافیک'],
    cons: ['فضای صندوق محدود', 'کابین شلوغ'],
    specs: {
      engine: 'M15 1.5L',
      horsepower: 103,
      torque: '138 Nm',
      gearbox: 'CVT',
      transmission: 'automatic',
      fuelType: 'gasoline',
      fuelConsumption: '۷.۸ لیتر',
      acceleration: '۰–۱۰۰: حدود ۱۲s',
      maxSpeed: 175,
      weight: 1120,
      trunk: 225,
    },
    market: {
      avgPrice: 1_120_000_000,
      minPrice: 980_000_000,
      maxPrice: 1_280_000_000,
      adsCount: 612,
      priceChange30d: -0.015,
      priceChange1y: -0.07,
      liquidityScore: 80,
    },
    scores: {
      performanceScore: 48,
      comfortScore: 52,
      economyScore: 74,
      reliabilityScore: 56,
      marketScore: 82,
      ownershipScore: 76,
      prestigeScore: 38,
      riskScore: 40,
      overallScore: 60,
    },
    priceBase: 1_120_000_000,
  },
  {
    brand: 'مزدا',
    model: '۳ جدید',
    year: 1400,
    bodyType: 'سدان',
    segment: 'اسپرت‌ملایم',
    image: null,
    pros: ['هندلینگ عالی', 'کیفیت سواری', 'پرستیژ'],
    cons: ['هزینه نگهداری بالاتر', 'قطعات گران‌تر'],
    specs: {
      engine: 'SkyActiv-G 2.0L',
      horsepower: 153,
      torque: '200 Nm',
      gearbox: 'AT ۶ سرعته',
      transmission: 'automatic',
      fuelType: 'gasoline',
      fuelConsumption: '۷.۹ لیتر',
      acceleration: '۰–۱۰۰: حدود ۸.۵s',
      maxSpeed: 210,
      weight: 1320,
      trunk: 420,
    },
    market: {
      avgPrice: 4_800_000_000,
      minPrice: 4_300_000_000,
      maxPrice: 5_400_000_000,
      adsCount: 186,
      priceChange30d: 0.011,
      priceChange1y: 0.09,
      liquidityScore: 62,
    },
    scores: {
      performanceScore: 88,
      comfortScore: 82,
      economyScore: 55,
      reliabilityScore: 78,
      marketScore: 64,
      ownershipScore: 52,
      prestigeScore: 86,
      riskScore: 38,
      overallScore: 73,
    },
    priceBase: 4_800_000_000,
  },
  {
    brand: 'تویوتا',
    model: 'کرولا هیبرید',
    year: 1399,
    bodyType: 'سدان',
    segment: 'خانوادگی پایدار',
    image: null,
    pros: ['مصرف بسیار کم', 'اطمینان بالا', 'بازار دست دوم قوی'],
    cons: ['قیمت بالا', 'شتاب کمتر از رقبای توربو'],
    specs: {
      engine: '1.8L + موتور برقی',
      horsepower: 121,
      torque: 'ترکیبی هیبرید',
      gearbox: 'e-CVT',
      transmission: 'automatic',
      fuelType: 'hybrid',
      fuelConsumption: '۴.۵ لیتر',
      acceleration: '۰–۱۰۰: حدود ۱۰s',
      maxSpeed: 180,
      weight: 1370,
      trunk: 470,
    },
    market: {
      avgPrice: 5_200_000_000,
      minPrice: 4_700_000_000,
      maxPrice: 5_800_000_000,
      adsCount: 124,
      priceChange30d: 0.014,
      priceChange1y: 0.11,
      liquidityScore: 58,
    },
    scores: {
      performanceScore: 60,
      comfortScore: 76,
      economyScore: 92,
      reliabilityScore: 92,
      marketScore: 78,
      ownershipScore: 62,
      prestigeScore: 72,
      riskScore: 22,
      overallScore: 76,
    },
    priceBase: 5_200_000_000,
  },
  {
    brand: 'رنو',
    model: 'ساندرو پلاس',
    year: 1398,
    bodyType: 'هاچ‌بک',
    segment: 'شهری',
    image: null,
    pros: ['باکیفیت‌تر از رده اقتصادی', 'صندوق خوب برای هاچ‌بک'],
    cons: ['نوسان قیمت قطعات', 'ندرت در بعضی قطعات'],
    specs: {
      engine: 'H4M 1.6L',
      horsepower: 105,
      torque: '148 Nm',
      gearbox: 'CVT',
      transmission: 'automatic',
      fuelType: 'gasoline',
      fuelConsumption: '۷.۶ لیتر',
      acceleration: '۰–۱۰۰: حدود ۱۱s',
      maxSpeed: 180,
      weight: 1145,
      trunk: 328,
    },
    market: {
      avgPrice: 1_720_000_000,
      minPrice: 1_550_000_000,
      maxPrice: 1_920_000_000,
      adsCount: 388,
      priceChange30d: -0.005,
      priceChange1y: -0.03,
      liquidityScore: 76,
    },
    scores: {
      performanceScore: 55,
      comfortScore: 60,
      economyScore: 72,
      reliabilityScore: 66,
      marketScore: 76,
      ownershipScore: 68,
      prestigeScore: 48,
      riskScore: 36,
      overallScore: 63,
    },
    priceBase: 1_720_000_000,
  },
  {
    brand: 'BMW',
    model: '۳۲۰i اپلای',
    year: 2017,
    bodyType: 'سدان',
    segment: 'لوکس دست‌دوم',
    image: null,
    pros: ['دینامیک رانندگی', 'پرستیژ بالا', 'امکانات'],
    cons: ['هزینه تعمیر بالا', 'ریسک خرید بدون کارشناسی'],
    specs: {
      engine: 'B48 2.0L Turbo',
      horsepower: 184,
      torque: '270 Nm',
      gearbox: 'AT ۸ سرعته',
      transmission: 'automatic',
      fuelType: 'gasoline',
      fuelConsumption: '۶.۵ لیتر ترکیبی (کاتالوگ)',
      acceleration: '۰–۱۰۰: حدود ۷.۱s',
      maxSpeed: 235,
      weight: 1440,
      trunk: 480,
    },
    market: {
      avgPrice: 6_900_000_000,
      minPrice: 6_100_000_000,
      maxPrice: 7_800_000_000,
      adsCount: 68,
      priceChange30d: 0.018,
      priceChange1y: 0.15,
      liquidityScore: 48,
    },
    scores: {
      performanceScore: 92,
      comfortScore: 84,
      economyScore: 42,
      reliabilityScore: 70,
      marketScore: 56,
      ownershipScore: 38,
      prestigeScore: 94,
      riskScore: 62,
      overallScore: 68,
    },
    priceBase: 6_900_000_000,
  },
  {
    brand: 'هیوندای',
    model: 'توسان ix35',
    year: 2018,
    bodyType: 'کراس‌اوور',
    segment: 'سفر / خانواده',
    image: null,
    pros: ['فضا و چشم‌انداز', 'مناسب جاده‌سفر'],
    cons: ['مصرف بالاتر از سدان خانوادگی', 'حس معامله پرریسک برای مدل‌های کارکرده'],
    specs: {
      engine: 'Nu 2.0L',
      horsepower: 154,
      torque: '196 Nm',
      gearbox: 'AT ۶ سرعته',
      transmission: 'automatic',
      fuelType: 'gasoline',
      fuelConsumption: '۹.۵ لیتر',
      acceleration: '۰–۱۰۰: حدود ۹.۵s',
      maxSpeed: 195,
      weight: 1495,
      trunk: 513,
    },
    market: {
      avgPrice: 3_050_000_000,
      minPrice: 2_700_000_000,
      maxPrice: 3_450_000_000,
      adsCount: 241,
      priceChange30d: 0.007,
      priceChange1y: 0.05,
      liquidityScore: 66,
    },
    scores: {
      performanceScore: 70,
      comfortScore: 74,
      economyScore: 52,
      reliabilityScore: 74,
      marketScore: 70,
      ownershipScore: 55,
      prestigeScore: 62,
      riskScore: 46,
      overallScore: 66,
    },
    priceBase: 3_050_000_000,
  },
  {
    brand: 'کیا',
    model: 'سراتو ۲۰۰۰ YD',
    year: 2015,
    bodyType: 'سدان',
    segment: 'میان‌رده دست‌دوم',
    image: null,
    pros: ['پایداری نسبی گیربکس', 'راحتی برای خانواده'],
    cons: ['مدل قدیمی', 'افت قیمت در صورت تعمیر اساسی'],
    specs: {
      engine: 'Nu 2.0L',
      horsepower: 154,
      torque: '196 Nm',
      gearbox: 'AT ۶ سرعته',
      transmission: 'automatic',
      fuelType: 'gasoline',
      fuelConsumption: '۸.۸ لیتر',
      acceleration: '۰–۱۰۰: حدود ۱۰s',
      maxSpeed: 195,
      weight: 1285,
      trunk: 482,
    },
    market: {
      avgPrice: 2_150_000_000,
      minPrice: 1_900_000_000,
      maxPrice: 2_400_000_000,
      adsCount: 310,
      priceChange30d: -0.004,
      priceChange1y: -0.02,
      liquidityScore: 72,
    },
    scores: {
      performanceScore: 65,
      comfortScore: 70,
      economyScore: 60,
      reliabilityScore: 72,
      marketScore: 74,
      ownershipScore: 62,
      prestigeScore: 56,
      riskScore: 44,
      overallScore: 65,
    },
    priceBase: 2_150_000_000,
  },
];

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

/** هم‌خوان با normalizeAliasPhrase در API */
function normalizeAlias(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/٠/g, '0')
    .replace(/١/g, '1')
    .replace(/٢/g, '2')
    .replace(/٣/g, '3')
    .replace(/٤/g, '4')
    .replace(/٥/g, '5')
    .replace(/٦/g, '6')
    .replace(/٧/g, '7')
    .replace(/٨/g, '8')
    .replace(/٩/g, '9');
}

async function main() {
  await prisma.userEvent.deleteMany();
  await prisma.recommendationResult.deleteMany();
  await prisma.recommendationSession.deleteMany();
  await prisma.userPreferenceSignal.deleteMany();
  await prisma.carBehaviorMetricsDaily.deleteMany();
  await prisma.marketCycle.deleteMany();
  await prisma.carLiquidityStats.deleteMany();
  await prisma.comparison.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.carFeatureScores.deleteMany();
  await prisma.carReviewsRaw.deleteMany();
  await prisma.carListing.deleteMany();
  await prisma.segmentMarketIndex.deleteMany();
  await prisma.pricePrediction.deleteMany();
  await prisma.ownershipCost.deleteMany();
  await prisma.carScores.deleteMany();
  await prisma.carMarketData.deleteMany();
  await prisma.carSpecs.deleteMany();
  await prisma.userWishlist.deleteMany();
  await prisma.carAlias.deleteMany();
  await prisma.car.deleteMany();

  const startHistory = new Date();
  startHistory.setMonth(startHistory.getMonth() - 7);

  for (const row of CARS) {
    const car = await prisma.car.create({
      data: {
        brand: row.brand,
        model: row.model,
        year: row.year,
        bodyType: row.bodyType,
        segment: row.segment,
        image: row.image,
        pros: row.pros,
        cons: row.cons,
        specs: { create: row.specs },
        marketData: {
          create: {
            avgPrice: dec(row.market.avgPrice),
            minPrice: dec(row.market.minPrice),
            maxPrice: dec(row.market.maxPrice),
            adsCount: row.market.adsCount,
            priceChange30d: dec(row.market.priceChange30d),
            priceChange1y: dec(row.market.priceChange1y),
            liquidityScore: row.market.liquidityScore,
          },
        },
        scores: { create: row.scores },
      },
    });

    const displayAlias = `${row.brand} ${row.model}`;
    await prisma.carAlias.create({
      data: {
        carId: car.id,
        alias: displayAlias,
        normalized: normalizeAlias(displayAlias),
        weight: 10,
      },
    });

    for (let i = 0; i < 14; i++) {
      const d = new Date(startHistory);
      d.setDate(d.getDate() + i * 15);
      const jitter = 1 + 0.018 * Math.sin(i * 0.7) + (i % 3) * 0.002;
      const price = Math.round(row.priceBase * jitter);
      await prisma.priceHistory.create({
        data: {
          carId: car.id,
          date: d,
          price: dec(price),
        },
      });
    }
  }

  // نمونه مقایسه ذخیره‌شده (اختیاری؛ GET /compare زنده هم دارد)
  const [c0, c1] = await prisma.car.findMany({ take: 2, orderBy: { brand: 'asc' } });
  if (c0 && c1) {
    await prisma.comparison.create({
      data: {
        carAId: c0.id,
        carBId: c1.id,
        economicWinner: c0.id,
        familyWinner: c1.id,
        sportWinner: c0.id,
        cityWinner: c0.id,
        tripWinner: c1.id,
        investmentWinner: c1.id,
      },
    });
  }

  console.log(
    `Seeded ${CARS.length} cars + CarAlias, specs, market, scores, price history.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
