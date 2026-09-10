import { Schema, model, Document, Types } from "mongoose";

export interface IExpenditure extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  submittedBy: Types.ObjectId;
  date: Date;
  amount: number;
  category: string;
  invoiceNumber?: string;
  vendor?: string;
  justification?: string;
  documentIds: Types.ObjectId[];
  createdAt: Date;
}

const ExpenditureSchema = new Schema<IExpenditure>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  invoiceNumber: { type: String },
  vendor: { type: String },
  justification: { type: String },
  documentIds: [{ type: Schema.Types.ObjectId, ref: "Document" }],
  createdAt: { type: Date, default: Date.now },
});

export const Expenditure = model<IExpenditure>("Expenditure", ExpenditureSchema);
