import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  console.log(`[db] connected to ${env.mongodbUri}`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
