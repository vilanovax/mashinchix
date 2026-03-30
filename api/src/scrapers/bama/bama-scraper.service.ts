import { Injectable, Logger } from '@nestjs/common';

/**
 * جایگاه پیاده‌سازی بعدی برای باما؛ فعلاً آگهی ذخیره نمی‌شود.
 */
@Injectable()
export class BamaScraperService {
  private readonly logger = new Logger(BamaScraperService.name);

  async scrapeAndPersist(): Promise<{ fetched: number; saved: number }> {
    this.logger.warn('Bama scraper not implemented yet');
    return { fetched: 0, saved: 0 };
  }
}
