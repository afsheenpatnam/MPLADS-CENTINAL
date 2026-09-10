import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { reviewException } from "../controllers/exceptionController";

const router = Router();
router.use(authenticate);

router.post("/:id/review", reviewException);

export default router;
