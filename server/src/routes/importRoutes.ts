import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { importProjects } from "../controllers/importController";

const router = Router();
router.use(authenticate);

router.post("/projects", upload.single("file"), importProjects);

export default router;
