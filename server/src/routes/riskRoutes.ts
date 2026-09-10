import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { getHighPriorityProjects } from "../controllers/detectionController";

const router = Router();
router.use(authenticate);

// Risk/priority are officer-only intelligence — never exposed to a contractor.
router.get("/high-priority", authorize("OFFICER"), getHighPriorityProjects);

export default router;
