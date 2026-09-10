import { NextFunction, Request, Response } from "express";
import { Sanction } from "../models/Sanction";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Blocks contractor submissions (progress/expenditure/site-visits/evidence/daily-activity
 * import) until the officer's sanction for the project has been approved by that contractor.
 * Officers bypass this check entirely — it only gates the CONTRACTOR-facing write endpoints.
 */
export const requireApprovedSanction = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (req.user!.role !== "CONTRACTOR") return next();

    const sanction = await Sanction.findOne({ projectId: req.project!._id });
    if (!sanction) {
      throw ApiError.forbidden("This project has no sanction yet — nothing to submit against");
    }
    if (sanction.status !== "APPROVED") {
      throw ApiError.forbidden(
        "You must review and approve the project sanction before submitting activity"
      );
    }
    next();
  }
);
