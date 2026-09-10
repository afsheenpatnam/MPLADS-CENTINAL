import { Types } from "mongoose";
import { Sanction } from "../../models/Sanction";
import { ApiError } from "../../utils/apiError";

/**
 * Contractors cannot submit any project activity (manual or CSV) until they have reviewed
 * and approved the sanction — this is the "sanction becomes the baseline" gate from the brief.
 */
export async function assertSanctionApproved(projectId: Types.ObjectId | string): Promise<void> {
  const sanction = await Sanction.findOne({ projectId });
  if (!sanction) {
    throw ApiError.badRequest("This project has no sanction defined yet");
  }
  if (sanction.status !== "APPROVED") {
    throw ApiError.forbidden("The sanction for this project must be approved before activity can be submitted");
  }
}
