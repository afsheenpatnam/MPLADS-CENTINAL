import { Schema, model, Document as MongooseDocument, Types } from "mongoose";

export interface IProjectDocument extends MongooseDocument {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  type: string;
  fileName: string;
  filePath: string;
  documentHash: string;
  amount?: number;
  invoiceNumber?: string;
  vendor?: string;
  date?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const ProjectDocumentSchema = new Schema<IProjectDocument>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  documentHash: { type: String, required: true },
  amount: { type: Number },
  invoiceNumber: { type: String },
  vendor: { type: String },
  date: { type: Date },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

ProjectDocumentSchema.index({ documentHash: 1 });
ProjectDocumentSchema.index({ invoiceNumber: 1 });

export const ProjectDocument = model<IProjectDocument>("ProjectDocument", ProjectDocumentSchema);
