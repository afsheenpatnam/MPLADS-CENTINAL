import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { signToken } from "../utils/jwt";
import { recordAudit } from "../services/audit/auditService";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["OFFICER", "CONTRACTOR"]),
  phone: z.string().optional(),
  department: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function toPublicUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  phone?: string;
  department?: string;
  active: boolean;
  createdAt: Date;
}) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    department: user.department,
    active: user.active,
    createdAt: user.createdAt,
  };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = registerSchema.parse(req.body);

  const existing = await User.findOne({ email: body.email });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await User.create({
    name: body.name,
    email: body.email,
    passwordHash,
    role: body.role,
    phone: body.phone,
    department: body.department,
  });

  const token = signToken({ userId: user._id.toString(), role: user.role, email: user.email });
  res.status(201).json({ token, user: toPublicUser(user) });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);

  const user = await User.findOne({ email: body.email }).select("+passwordHash");
  if (!user || !user.active) throw ApiError.unauthorized("Invalid email or password");

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const token = signToken({ userId: user._id.toString(), role: user.role, email: user.email });

  await recordAudit({
    user: { userId: user._id.toString(), role: user.role, email: user.email },
    action: "LOGIN",
    entity: "User",
    entityId: user._id,
  });

  res.json({ token, user: toPublicUser(user) });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId);
  if (!user) throw ApiError.notFound("User not found");
  res.json({ user: toPublicUser(user) });
});
