const request = require("supertest");
const app = require("../../app");

describe("Auth", () => {
  it("should login with valid user", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      username: "admit",
      password: "123"
    });
    console.log("res.body.token:", res.body.token);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});