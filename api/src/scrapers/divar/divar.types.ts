export interface NormalizedCarListing {
  externalId: string;
  title?: string;
  description?: string;
  priceTomans: number;
  mileageKm?: number;
  yearModel?: number;
  city?: string;
  listedAt?: Date;
  listingUrl?: string;
  raw?: Record<string, unknown>;
}
