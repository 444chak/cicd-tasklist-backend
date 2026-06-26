import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { vi } from "vitest";
import testPrisma from "./setup.js";

// Mock the prisma singleton to use the test client
vi.mock("../../lib/prisma.js", () => ({
	default: testPrisma,
}));

// Import app AFTER mocking prisma
const { default: app } = await import("../../app.js");
import request from "supertest";

describe("Task API E2E Tests", () => {
	beforeEach(async () => {
		// Clean up database between tests
		await testPrisma.task.deleteMany();
	});

	afterAll(async () => {
		await testPrisma.$disconnect();
	});

	describe("POST /api/tasks", () => {
		it("should create a new task", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "E2E Task", description: "E2E Description" });

			expect(res.status).toBe(201);
			expect(res.body).toHaveProperty("id");
			expect(res.body.title).toBe("E2E Task");
			expect(res.body.description).toBe("E2E Description");
			expect(res.body.completed).toBe(false);
		});

		it.each([
			{},
			{ title: "" },
			{ title: "   " },
			{ title: 42 },
		])("should reject invalid body %#", async (body) => {
			const res = await request(app).post("/api/tasks").send(body);

			expect(res.status).toBe(400);
			expect(res.body).toEqual({
				error: "Title is required and must be a non-empty string",
			});
		});

		it("should trim the title and allow an omitted description", async () => {
			const res = await request(app).post("/api/tasks").send({ title: "  Trim me  " });

			expect(res.status).toBe(201);
			expect(res.body.title).toBe("Trim me");
			expect(res.body.description).toBeNull();
		});
	});

	describe("GET /api/tasks", () => {
		it("should return tasks ordered by newest first", async () => {
			await testPrisma.task.create({
				data: { title: "Older task", createdAt: new Date("2026-01-01T00:00:00.000Z") },
			});
			await testPrisma.task.create({
				data: { title: "Newer task", createdAt: new Date("2026-01-02T00:00:00.000Z") },
			});

			const res = await request(app).get("/api/tasks");

			expect(res.status).toBe(200);
			expect(res.body).toHaveLength(2);
			expect(res.body[0].title).toBe("Newer task");
			expect(res.body[1].title).toBe("Older task");
		});
	});

	describe("GET /api/tasks/:id", () => {
		it("should reject an invalid id", async () => {
			const res = await request(app).get("/api/tasks/not-a-number");

			expect(res.status).toBe(400);
			expect(res.body).toEqual({ error: "Invalid task ID" });
		});

		it("should return 404 for a missing task", async () => {
			const res = await request(app).get("/api/tasks/999");

			expect(res.status).toBe(404);
			expect(res.body).toEqual({ error: "Task not found" });
		});

		it("should return a task by id", async () => {
			const task = await testPrisma.task.create({
				data: { title: "Find me", description: "Details" },
			});

			const res = await request(app).get(`/api/tasks/${task.id}`);

			expect(res.status).toBe(200);
			expect(res.body.id).toBe(task.id);
			expect(res.body.title).toBe("Find me");
			expect(res.body.description).toBe("Details");
		});
	});

	describe("PUT /api/tasks/:id", () => {
		it("should reject an invalid id", async () => {
			const res = await request(app)
				.put("/api/tasks/not-a-number")
				.send({ completed: true });

			expect(res.status).toBe(400);
			expect(res.body).toEqual({ error: "Invalid task ID" });
		});

		it("should return 404 for a missing task", async () => {
			const res = await request(app).put("/api/tasks/999").send({ completed: true });

			expect(res.status).toBe(404);
			expect(res.body).toEqual({ error: "Task not found" });
		});

		it("should update a task", async () => {
			const task = await testPrisma.task.create({
				data: { title: "Before", description: "Old description" },
			});

			const res = await request(app).put(`/api/tasks/${task.id}`).send({
				title: "After",
				description: "New description",
				completed: true,
			});

			expect(res.status).toBe(200);
			expect(res.body.title).toBe("After");
			expect(res.body.description).toBe("New description");
			expect(res.body.completed).toBe(true);
		});
	});

	describe("DELETE /api/tasks/:id", () => {
		it("should reject an invalid id", async () => {
			const res = await request(app).delete("/api/tasks/not-a-number");

			expect(res.status).toBe(400);
			expect(res.body).toEqual({ error: "Invalid task ID" });
		});

		it("should return 404 for a missing task", async () => {
			const res = await request(app).delete("/api/tasks/999");

			expect(res.status).toBe(404);
			expect(res.body).toEqual({ error: "Task not found" });
		});

		it("should delete a task", async () => {
			const task = await testPrisma.task.create({
				data: { title: "Delete me" },
			});

			const res = await request(app).delete(`/api/tasks/${task.id}`);
			const deletedTask = await testPrisma.task.findUnique({ where: { id: task.id } });

			expect(res.status).toBe(204);
			expect(res.body).toEqual({});
			expect(deletedTask).toBeNull();
		});
	});
});
