import { Request, Response } from "express";
import { AuditLog } from "../models/AuditLog";
import { asyncHandler } from "../utils/asyncHandler";

export const getProjectAudit = asyncHandler(async (req: Request, res: Response) => {
  const logs = await AuditLog.find({ projectId: req.project!._id })
    .populate("userId", "name role")
    .sort({ timestamp: -1 })
    .limit(500);
  res.json({ logs });
});
