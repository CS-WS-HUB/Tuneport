import { Router, type IRouter } from "express";
import {
  marketplacePricingConfiguration,
  quoteMarketplacePrice,
} from "../lib/marketplace-pricing";

const router: IRouter = Router();

router.get("/marketplace/pricing", (_req, res, next) => {
  try {
    res.json({ pricing: marketplacePricingConfiguration() });
  } catch (error) {
    next(error);
  }
});

router.post("/marketplace/quote", (req, res, next) => {
  try {
    const amount = req.body?.listingAmountCents;
    if (typeof amount !== "number" || !Number.isSafeInteger(amount)) {
      res.status(400).json({
        error: {
          code: "INVALID_LISTING_AMOUNT",
          message: "listingAmountCents must be an integer number of cents.",
        },
      });
      return;
    }

    res.json({ quote: quoteMarketplacePrice(amount) });
  } catch (error) {
    if (error instanceof RangeError) {
      res.status(400).json({
        error: {
          code: "LISTING_AMOUNT_OUT_OF_RANGE",
          message: error.message,
        },
      });
      return;
    }
    next(error);
  }
});

export default router;
