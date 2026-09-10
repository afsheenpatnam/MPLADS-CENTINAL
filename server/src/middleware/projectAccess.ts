import { NextFunction, Request, Response } from "express";
import { Project } from "../models/Project";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      project?: InstanceType<typeof Project>;
    }
  }
}

/**
 * Loads req.params.id as a Project and enforces role-scoped access:
 * OFFICER only their own projects, CONTRACTOR only assigned projects.
 */
export const loadProjectWithAccess = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const project = await Project.findById(req.params.id);
    if (!project) throw ApiError.notFound("Project not found");

    const user = req.user!;
    if (user.role === "OFFICER" && project.officerId.toString() !== user.userId) {
      throw ApiError.forbidden("You do not have access to this project");
    }
    if (user.role === "CONTRACTOR" && project.contractorId?.toString() !== user.userId) {
      throw ApiError.forbidden("You do not have access to this project");
    }

    req.project = project;
    next();
  }
);
