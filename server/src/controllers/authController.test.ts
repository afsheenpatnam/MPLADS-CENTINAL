import request from "supertest";
import { createApp } from "../app";
import { clearTestDb, startTestDb, stopTestDb } from "../test-utils/testDb";

const app = createApp();

beforeAll(async () => {
  await startTestDb();
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

describe("Auth API", () => {
  it("registers a new officer and returns a token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test Officer",
      email: "officer.test@mplad.local",
      password: "password123",
      role: "OFFICER",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.email).toBe("officer.test@mplad.local");
  });

  it("rejects duplicate email registration", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Test Officer",
      email: "dup@mplad.local",
      password: "password123",
      role: "OFFICER",
    });
    const res = await request(app).post("/api/auth/register").send({
      name: "Another",
      email: "dup@mplad.local",
      password: "password123",
      role: "OFFICER",
    });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and rejects wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login Test",
      email: "login.test@mplad.local",
      password: "correct-password",
      role: "CONTRACTOR",
    });

    const good = await request(app).post("/api/auth/login").send({
      email: "login.test@mplad.local",
      password: "correct-password",
    });
    expect(good.status).toBe(200);
    expect(good.body.token).toBeDefined();

    const bad = await request(app).post("/api/auth/login").send({
      email: "login.test@mplad.local",
      password: "wrong-password",
    });
    expect(bad.status).toBe(401);
  });

  it("rejects /me without a token and accepts with a valid token", async () => {
    const register = await request(app).post("/api/auth/register").send({
      name: "Me Test",
      email: "me.test@mplad.local",
      password: "password123",
      role: "OFFICER",
    });

    const unauthenticated = await request(app).get("/api/auth/me");
    expect(unauthenticated.status).toBe(401);

    const authenticated = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${register.body.token}`);
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.user.email).toBe("me.test@mplad.local");
  });
});
