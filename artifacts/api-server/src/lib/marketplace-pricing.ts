const DEFAULT_COMMISSION_BPS = 1_200;
const DEFAULT_CARD_PROCESSING_BPS = 290;
const DEFAULT_CARD_FIXED_FEE_CENTS = 30;
const MAX_LISTING_AMOUNT_CENTS = 10_000_000;

function readBps(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new Error(`${name} must be an integer between 0 and 10000 basis points`);
  }
  return parsed;
}

function readNonNegativeInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

export interface MarketplacePriceQuote {
  currency: "usd";
  buyerTotalCents: number;
  sellerCommissionCents: number;
  sellerPayoutCents: number;
  estimatedCardProcessingCents: number;
  estimatedPlatformContributionCents: number;
  commissionBasisPoints: number;
  processingEstimateBasisPoints: number;
  processingEstimateFixedCents: number;
  processingEstimateIsNotFinal: true;
}

/**
 * Estimates the economics for a seller-funded marketplace transaction.
 * Buyer pays the listed amount; the seller-funded commission is deducted
 * from the seller's transfer. Stripe processing is an estimate and is borne
 * by the platform, not added as a buyer surcharge.
 */
export function quoteMarketplacePrice(listingAmountCents: number): MarketplacePriceQuote {
  if (
    !Number.isSafeInteger(listingAmountCents) ||
    listingAmountCents < 100 ||
    listingAmountCents > MAX_LISTING_AMOUNT_CENTS
  ) {
    throw new RangeError(
      `listingAmountCents must be an integer between 100 and ${MAX_LISTING_AMOUNT_CENTS}`,
    );
  }

  const commissionBasisPoints = readBps(
    "MARKETPLACE_COMMISSION_BPS",
    DEFAULT_COMMISSION_BPS,
  );
  if (commissionBasisPoints >= 10_000) {
    throw new Error("MARKETPLACE_COMMISSION_BPS must be less than 10000 basis points");
  }
  const processingEstimateBasisPoints = readBps(
    "STRIPE_CARD_PROCESSING_ESTIMATE_BPS",
    DEFAULT_CARD_PROCESSING_BPS,
  );
  const processingEstimateFixedCents = readNonNegativeInteger(
    "STRIPE_CARD_PROCESSING_FIXED_ESTIMATE_CENTS",
    DEFAULT_CARD_FIXED_FEE_CENTS,
  );

  const sellerCommissionCents = Math.round(
    (listingAmountCents * commissionBasisPoints) / 10_000,
  );
  const sellerPayoutCents = listingAmountCents - sellerCommissionCents;
  const estimatedCardProcessingCents =
    Math.round((listingAmountCents * processingEstimateBasisPoints) / 10_000) +
    processingEstimateFixedCents;

  return {
    currency: "usd",
    buyerTotalCents: listingAmountCents,
    sellerCommissionCents,
    sellerPayoutCents,
    estimatedCardProcessingCents,
    estimatedPlatformContributionCents:
      sellerCommissionCents - estimatedCardProcessingCents,
    commissionBasisPoints,
    processingEstimateBasisPoints,
    processingEstimateFixedCents,
    processingEstimateIsNotFinal: true,
  };
}

export const marketplacePricingConfiguration = () => {
  const commissionBasisPoints = readBps(
    "MARKETPLACE_COMMISSION_BPS",
    DEFAULT_COMMISSION_BPS,
  );
  if (commissionBasisPoints >= 10_000) {
    throw new Error("MARKETPLACE_COMMISSION_BPS must be less than 10000 basis points");
  }
  return {
  currency: "usd" as const,
  commissionBasisPoints,
  processingEstimateBasisPoints: readBps(
    "STRIPE_CARD_PROCESSING_ESTIMATE_BPS",
    DEFAULT_CARD_PROCESSING_BPS,
  ),
  processingEstimateFixedCents: readNonNegativeInteger(
    "STRIPE_CARD_PROCESSING_FIXED_ESTIMATE_CENTS",
    DEFAULT_CARD_FIXED_FEE_CENTS,
  ),
  minimumListingAmountCents: 100,
  maximumListingAmountCents: MAX_LISTING_AMOUNT_CENTS,
  processingEstimateIsNotFinal: true as const,
  };
};
