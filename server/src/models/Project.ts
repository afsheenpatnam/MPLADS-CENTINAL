import { Schema, model, Document, Types } from "mongoose";

export type ProjectStatus = "PLANNED" | "ACTIVE" | "DELAYED" | "COMPLETED" | "SUSPENDED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface IProject extends Document {
  _id: Types.ObjectId;
  projectCode: string;
  externalProjectId?: string;
  name: string;
  description: string;
  projectType: string;
  state: string;
  district: string;
  location: string;
  latitude: number;
  longitude: number;

  officerId: Types.ObjectId;
  contractorId?: Types.ObjectId;

  sanctionedAmount: number;
  releasedAmount: number;
  spentAmount: number;

  startDate: Date;
  endDate: Date;

  approvedWork: string;
  approvedQuantity: number;
  quantityUnit: string;
  approvedMaterials: string;

  expectedProgress: number;
  actualProgress: number;

  status: ProjectStatus;

  riskScore: number;
  riskLevel: RiskLevel;
  priority: RiskLevel;

  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    projectCode: { type: String, required: true, unique: true },
    externalProjectId: { type: String },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    projectType: { type: String, required: true },
    state: { type: String, required: true },
    district: { type: String, required: true },
    location: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },

    officerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contractorId: { type: Schema.Types.ObjectId, ref: "User" },

    sanctionedAmount: { type: Number, required: true },
    releasedAmount: { type: Number, default: 0 },
    spentAmount: { type: Number, default: 0 },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    approvedWork: { type: String, default: "" },
    approvedQuantity: { type: Number, default: 0 },
    quantityUnit: { type: String, default: "" },
    approvedMaterials: { type: String, default: "" },

    expectedProgress: { type: Number, default: 0 },
    actualProgress: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["PLANNED", "ACTIVE", "DELAYED", "COMPLETED", "SUSPENDED"],
      default: "PLANNED",
    },

    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "LOW" },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "LOW" },
  },
  { timestamps: true }
);

ProjectSchema.index({ externalProjectId: 1 }, { sparse: true });
ProjectSchema.index({ district: 1 });
ProjectSchema.index({ contractorId: 1 });
ProjectSchema.index({ riskLevel: 1 });

export const Project = model<IProject>("Project", ProjectSchema);
