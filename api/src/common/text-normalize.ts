/** نرمال‌سازی یکسان برای مچ عنوان آگهی و alias */
export function normalizePersianTitle(s: string): string {
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

export function normalizeAliasPhrase(raw: string): string {
  return normalizePersianTitle(raw);
}
