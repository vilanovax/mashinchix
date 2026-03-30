import { NormalizedCarListing } from './divar.types';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const EN_DIGITS = '0123456789';

function faToEnDigits(s: string): string {
  let out = '';
  for (const ch of s) {
    const i = FA_DIGITS.indexOf(ch);
    out += i >= 0 ? EN_DIGITS[i] : ch;
  }
  return out;
}

/** استخراج عدد تومانی از متن‌هایی مثل «۱،۴۵۰ میلیون تومان» */
export function parseTomansFromText(text: string): number | null {
  if (!text) return null;
  const t = faToEnDigits(text).replace(/\u200c/g, '');
  const million = /([\d,\.]+)\s*میلیون/i.exec(t);
  if (million) {
    const n = parseFloat(million[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1_000_000);
  }
  const rial = /([\d,\.]+)\s*ریال/i.exec(t);
  if (rial) {
    const n = parseFloat(rial[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) return null;
    return Math.round(n / 10);
  }
  const plain = /([\d,\.]{4,})\s*تومان/i.exec(t);
  if (plain) {
    const n = parseFloat(plain[1].replace(/,/g, ''));
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function pickNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(faToEnDigits(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * استخراج سطرهای آگهی از پاسخ دیوار (چند شکل وجود دارد؛ نسخهٔ API/HTML ممکن است عوض شود).
 * ردیف مورد انتظار: widget_type = POST_ROW یا آبجکت دارای token + title/data.
 */
export function parseDivarPostListResponse(root: unknown): NormalizedCarListing[] {
  const out: NormalizedCarListing[] = [];
  const seen = new Set<string>();

  const tryPush = (row: Record<string, unknown>) => {
    const token =
      pickString(row.token) ?? pickString(row.post_token) ?? pickString(row.postToken);
    if (!token || seen.has(token)) return;

    const title =
      pickString(row.title) ??
      pickString(row.bottom_text) ??
      pickString(row.top_description_text);
    const description =
      pickString(row.description) ??
      pickString(row.middle_description_text) ??
      pickString(row.top_description_text);

    let priceTomans =
      pickNumber(row.price) ??
      parseTomansFromText(description ?? '') ??
      parseTomansFromText(pickString(row.bottom_description_text) ?? '') ??
      null;

    if (priceTomans == null) return;
    if (priceTomans > 1e12) {
      priceTomans = Math.round(priceTomans / 10);
    }

    const mileageKm =
      pickNumber(row.mileage) ??
      pickNumber(row.usage) ??
      extractMileageFromText(description ?? '');

    const yearModel =
      pickNumber(row.year) ??
      pickNumber(row.production_year) ??
      extractYearFromText(description ?? title ?? '');

    const city = pickString(row.district) ?? pickString(row.city);

    const listedAt = parseListedAt(row.date);

    const listingUrl =
      pickString(row.url) ??
      (token ? `https://divar.ir/v/${token}` : undefined);

    seen.add(token);
    out.push({
      externalId: token,
      title,
      description,
      priceTomans: Math.round(priceTomans),
      mileageKm,
      yearModel,
      city,
      listedAt,
      listingUrl,
      raw: row,
    });
  };

  const visit = (node: unknown) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    if (typeof node !== 'object') return;
    const o = node as Record<string, unknown>;

    const wt = pickString(o.widget_type);
    if (wt === 'POST_ROW' && o.data && typeof o.data === 'object') {
      tryPush({ ...(o.data as Record<string, unknown>) });
    }
    if (typeof o.token === 'string' && (o.title || o.data)) {
      tryPush(o);
    }

    for (const v of Object.values(o)) visit(v);
  };

  visit(root);
  return out;
}

function extractMileageFromText(text: string): number | undefined {
  const t = faToEnDigits(text);
  const m = /کارکرد[:\s]*([\d،,]+)\s*کیلومتر/i.exec(t);
  if (m) {
    const n = parseInt(m[1].replace(/[،,]/g, ''), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function extractYearFromText(text: string): number | undefined {
  const t = faToEnDigits(text);
  const m = /(13\d{2}|14\d{2})/.exec(t);
  if (m) {
    const y = parseInt(m[1], 10);
    return y >= 1300 && y <= 1450 ? y : undefined;
  }
  return undefined;
}

function parseListedAt(v: unknown): Date | undefined {
  if (v instanceof Date) return v;
  if (typeof v === 'number' && v > 1e12) return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}
