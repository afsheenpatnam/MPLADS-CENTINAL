import { Router } from "express";
import authRoutes from "./authRoutes";
import projectRoutes from "./projectRoutes";
import clarificationRoutes from "./clarificationRoutes";
import exceptionRoutes from "./exceptionRoutes";
import riskRoutes from "./riskRoutes";
import importRoutes from "./importRoutes";
import sanctionRoutes from "./sanctionRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/projects", projectRoutes);
router.use("/clarification", clarificationRoutes);
router.use("/exception", exceptionRoutes);
router.use("/risk", riskRoutes);
router.use("/import", importRoutes);
router.use("/sanctions", sanctionRoutes);

export default router;
