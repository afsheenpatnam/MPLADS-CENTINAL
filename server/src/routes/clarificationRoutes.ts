import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { respondToClarification, reviewClarification } from "../controllers/clarificationController";

const router = Router();
router.use(authenticate);

router.post("/:id/respond", respondToClarification);
router.post("/:id/review", reviewClarification);

export default router;
