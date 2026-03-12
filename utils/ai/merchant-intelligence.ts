import { MerchantProfile } from '@/types/transaction';

export function normalizeMerchantName(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSimilarMerchant(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

export function findMerchantCategory(
  merchant: string,
  merchants: MerchantProfile[]
): string | undefined {
  const normalized = normalizeMerchantName(merchant);
  if (!normalized) return undefined;

  const exact = merchants.find((profile) => profile.normalizedName === normalized);
  if (exact) return exact.preferredCategoryId;

  const fuzzy = merchants.find((profile) => isSimilarMerchant(profile.normalizedName, normalized));
  return fuzzy?.preferredCategoryId;
}

export function learnMerchantCategory(
  merchant: string,
  categoryId: string,
  merchants: MerchantProfile[]
): MerchantProfile[] {
  const normalized = normalizeMerchantName(merchant);
  if (!normalized || !categoryId) return merchants;

  const existing = merchants.find((profile) => profile.normalizedName === normalized);
  if (existing) {
    return merchants.map((profile) =>
      profile.normalizedName === normalized
        ? {
            ...profile,
            preferredCategoryId: categoryId,
            transactionCount: profile.transactionCount + 1,
            lastUsed: new Date(),
          }
        : profile
    );
  }

  const newProfile: MerchantProfile = {
    id: `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
    merchantName: merchant,
    normalizedName: normalized,
    preferredCategoryId: categoryId,
    transactionCount: 1,
    lastUsed: new Date(),
  };

  return [...merchants, newProfile];
}
