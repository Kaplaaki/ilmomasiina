import { faker } from "@faker-js/faker";
import { afterAll, afterEach, beforeAll, beforeEach, RunnerTaskBase, vi } from "vitest";

import initApp from "../src/app";
import EmailService from "../src/mail";
import setupDatabase, { closeDatabase } from "../src/models";
import { AuditLog } from "../src/models/auditlog";
import { Event } from "../src/models/event";
import { Payment } from "../src/models/payment";
import { User } from "../src/models/user";
import { testUser } from "./testData";

const needsDb = (suite: RunnerTaskBase) => suite.name.includes("test/routes");
const needsApi = (suite: RunnerTaskBase) => suite.name.includes("test/routes");

// Common setup for all backend test files: initialize Sequelize & Fastify, tear down at test end.
beforeAll(async (suite) => {
  if (needsDb(suite)) {
    global.sequelize = await setupDatabase();
    // Drop the trigger that prevents deleting payments to allow test data to be reset.
    await global.sequelize.query("DROP TRIGGER IF EXISTS payment_prevent_delete ON payment;");
  } else {
    global.sequelize = undefined as any;
  }
  if (needsApi(suite)) {
    global.server = await initApp();
  } else {
    global.server = undefined as any;
  }
});
afterAll(async () => {
  if (global.sequelize) {
    await closeDatabase();
    global.sequelize = undefined as any;
  }
  if (global.server) {
    await global.server.close();
    global.server = undefined as any;
  }
});

beforeEach(async () => {
  // Ensure deterministic test data.
  faker.seed(133742069);

  if (sequelize) {
    // Delete test data that can conflict between tests.
    await User.truncate({ cascade: true, force: true });
    await Payment.truncate({ cascade: true, force: true });
    // Event truncation cascades to all other event data:
    await Event.truncate({ cascade: true, force: true });
    await AuditLog.truncate({ cascade: true, force: true });

    // Create a test user to ensure full functionality.
    global.adminUser = await testUser();

    // Create a token for the admin.
    global.adminToken = server.adminSession.createSession(global.adminUser);
  }
});

// Mock email sending: ensure no actual email is sent and allow checking for calls.
beforeAll(() => {
  global.emailSend = vi.spyOn(EmailService, "send").mockImplementation(async () => {});
});
afterEach(() => {
  emailSend.mockClear();
});
