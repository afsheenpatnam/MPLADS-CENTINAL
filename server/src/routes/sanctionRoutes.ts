import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { approveSanction, listPendingSanctions } from "../controllers/sanctionController";

const router = Router();
router.use(authenticate);

router.get("/pending", listPendingSanctions);
router.post("/:id/approve", approveSanction);

export default router;
