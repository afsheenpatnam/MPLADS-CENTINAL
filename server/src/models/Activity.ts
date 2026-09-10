import { Schema, model, Document, Types } from "mongoose";

/**
 * Raw record of one row from a contractor's Daily Activity CSV import. This is kept as its
 * own collection (separate from Progress/Expenditure/SiteVisit) so that:
 *  - CSV idempotency can be enforced with a unique (projectId, activityId) index — re-uploading
 *    the same CSV twice never creates duplicate Progress/Expenditure/SiteVisit records.
 *  - The raw imported row is preserved for audit/debugging even though its fields fan out into
 *    the existing Progress/Expenditure/SiteVisit models the rest of the app already uses.
 */
export interface IActivity extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  activityId: string;
  submittedBy: Types.ObjectId;

  activityDate: Date;
  progressPercent?: number;
  workCompletedDescription?: string;
  quantityCompleted?: number;
  quantityUnit?: string;

  expenditureAmount?: number;
  expenditureCategory?: string;
  invoiceNumber?: string;
  vendorName?: string;
  expenditureJustification?: string;

  siteVisitDate?: Date;
  siteVisitLatitude?: number;
  siteVisitLongitude?: number;

  evidenceFileNames: string[];
  remarks?: string;

  progressId?: Types.ObjectId;
  expenditureId?: Types.ObjectId;
  siteVisitId?: Types.ObjectId;

  importBatchId: string;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  activityId: { type: String, required: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

  activityDate: { type: Date, required: true },
  progressPercent: { type: Number },
  workCompletedDescription: { type: String },
  quantityCompleted: { type: Number },
  quantityUnit: { type: String },

  expenditureAmount: { type: Number },
  expenditureCategory: { type: String },
  invoiceNumber: { type: String },
  vendorName: { type: String },
  expenditureJustification: { type: String },

  siteVisitDate: { type: Date },
  siteVisitLatitude: { type: Number },
  siteVisitLongitude: { type: Number },

  evidenceFileNames: [{ type: String }],
  remarks: { type: String },

  progressId: { type: Schema.Types.ObjectId, ref: "Progress" },
  expenditureId: { type: Schema.Types.ObjectId, ref: "Expenditure" },
  siteVisitId: { type: Schema.Types.ObjectId, ref: "SiteVisit" },

  importBatchId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

ActivitySchema.index({ projectId: 1, activityId: 1 }, { unique: true });

export const Activity = model<IActivity>("Activity", ActivitySchema);
