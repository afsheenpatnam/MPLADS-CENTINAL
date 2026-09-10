import { Schema, model, Document, Types } from "mongoose";

export interface ISiteVisit extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  contractorId: Types.ObjectId;
  date: Date;
  latitude: number;
  longitude: number;
  remarks?: string;
  evidenceIds: Types.ObjectId[];
  status: "SCHEDULED" | "COMPLETED" | "MISSED";
  createdAt: Date;
}

const SiteVisitSchema = new Schema<ISiteVisit>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  contractorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  remarks: { type: String },
  evidenceIds: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],
  status: { type: String, enum: ["SCHEDULED", "COMPLETED", "MISSED"], default: "COMPLETED" },
  createdAt: { type: Date, default: Date.now },
});

export const SiteVisit = model<ISiteVisit>("SiteVisit", SiteVisitSchema);
