import { Schema, model, Document, Types } from "mongoose";

export type ValidationStatus = "VALID" | "MISSING" | "INVALID" | "INCONSISTENT" | "SUSPICIOUS" | "PENDING";

export interface ISimilarityResult {
  comparedEvidenceId: Types.ObjectId;
  similarityScore: number;
  comparisonType: "PERCEPTUAL_HASH" | "FILE_HASH";
}

export interface IEvidence extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  fileName: string;
  filePath: string;
  fileType: string;

  latitude?: number;
  longitude?: number;
  timestamp?: Date;

  imageHash?: string;
  perceptualHash?: string;
  fileHash: string;

  similarityResults: ISimilarityResult[];

  validationStatus: ValidationStatus;
  metadata: Record<string, unknown>;

  createdAt: Date;
}

const SimilarityResultSchema = new Schema<ISimilarityResult>(
  {
    comparedEvidenceId: { type: Schema.Types.ObjectId, ref: "Evidence", required: true },
    similarityScore: { type: Number, required: true },
    comparisonType: { type: String, enum: ["PERCEPTUAL_HASH", "FILE_HASH"], required: true },
  },
  { _id: false }
);

const EvidenceSchema = new Schema<IEvidence>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileType: { type: String, required: true },

  latitude: { type: Number },
  longitude: { type: Number },
  timestamp: { type: Date },

  imageHash: { type: String },
  perceptualHash: { type: String },
  fileHash: { type: String, required: true },

  similarityResults: [SimilarityResultSchema],

  validationStatus: {
    type: String,
    enum: ["VALID", "MISSING", "INVALID", "INCONSISTENT", "SUSPICIOUS", "PENDING"],
    default: "PENDING",
  },
  metadata: { type: Schema.Types.Mixed, default: {} },

  createdAt: { type: Date, default: Date.now },
});

EvidenceSchema.index({ projectId: 1 });
EvidenceSchema.index({ perceptualHash: 1 });

export const Evidence = model<IEvidence>("Evidence", EvidenceSchema);
