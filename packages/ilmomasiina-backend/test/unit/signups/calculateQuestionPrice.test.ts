import { describe, expect, test } from "vitest";

import { QuestionType } from "@tietokilta/ilmomasiina-models";
import type { QuestionAttributes } from "@tietokilta/ilmomasiina-models/dist/models";
import { calculateQuestionPrice } from "../../../src/routes/signups/updateSignup";

describe("calculateQuestionPrice", () => {
  describe("SELECT questions", () => {
    const baseQuestion = {
      id: "test-id",
      order: 0,
      question: "Test question",
      type: QuestionType.SELECT,
      eventId: "test-event-id",
      required: false,
      public: false,
    } satisfies Partial<QuestionAttributes>;

    test("returns correct price for selected option", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B", "Option C"],
        prices: [100, 200, 300], // prices in cents
      };

      const price = calculateQuestionPrice(question, "Option B");
      expect(price).toBe(200);
    });

    test("returns 0 for option not in prices array", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B", "Option C"],
        prices: [100], // prices array shorter than options
      };

      const price = calculateQuestionPrice(question, "Option C");
      expect(price).toBe(0);
    });

    test("returns 0 for non-existent option", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B"],
        prices: [100, 200],
      };

      const price = calculateQuestionPrice(question, "Option Z");
      expect(price).toBe(0);
    });

    test("returns 0 when prices is null", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B"],
        prices: null,
      };

      const price = calculateQuestionPrice(question, "Option A");
      expect(price).toBe(0);
    });

    test("returns 0 when options is null", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: null,
        prices: [100, 200],
      };

      const price = calculateQuestionPrice(question, "Option A");
      expect(price).toBe(0);
    });

    test("handles prices array longer than options", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B"],
        prices: [100, 200, 300, 400], // extra prices are ignored
      };

      const price = calculateQuestionPrice(question, "Option B");
      expect(price).toBe(200);
    });

    test("handles prices array shorter than options", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B", "Option C", "Option D"],
        prices: [100, 200], // missing prices for C and D
      };

      expect(calculateQuestionPrice(question, "Option A")).toBe(100);
      expect(calculateQuestionPrice(question, "Option B")).toBe(200);
      expect(calculateQuestionPrice(question, "Option C")).toBe(0);
      expect(calculateQuestionPrice(question, "Option D")).toBe(0);
    });

    test("returns 0 when receiving array answer", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B"],
        prices: [100, 200],
      };

      const price = calculateQuestionPrice(question, ["Option A"]);
      expect(price).toBe(0);
    });

    test("handles zero prices correctly", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Free Option", "Paid Option"],
        prices: [0, 100],
      };

      expect(calculateQuestionPrice(question, "Free Option")).toBe(0);
      expect(calculateQuestionPrice(question, "Paid Option")).toBe(100);
    });

    test("handles negative prices correctly", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B"],
        prices: [-50, 100],
      };

      const price = calculateQuestionPrice(question, "Option A");
      expect(price).toBe(-50);
    });
  });

  describe("CHECKBOX questions", () => {
    const baseQuestion = {
      id: "test-id",
      order: 0,
      question: "Test question",
      type: QuestionType.CHECKBOX,
      eventId: "test-event-id",
      required: false,
      public: false,
    } satisfies Partial<QuestionAttributes>;

    test("returns correct sum for multiple selections", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B", "Option C"],
        prices: [100, 200, 300],
      };

      const price = calculateQuestionPrice(question, ["Option A", "Option C"]);
      expect(price).toBe(400); // 100 + 300
    });

    test("returns correct price for single selection", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B", "Option C"],
        prices: [100, 200, 300],
      };

      const price = calculateQuestionPrice(question, ["Option B"]);
      expect(price).toBe(200);
    });

    test("returns 0 for empty selection array", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B"],
        prices: [100, 200],
      };

      const price = calculateQuestionPrice(question, []);
      expect(price).toBe(0);
    });

    test("handles selections with options not in prices array", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B", "Option C"],
        prices: [100, 200], // shorter than options
      };

      const price = calculateQuestionPrice(question, ["Option A", "Option C"]);
      expect(price).toBe(100); // Only Option A has a price
    });

    test("ignores non-existent options in selection", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B"],
        prices: [100, 200],
      };

      const price = calculateQuestionPrice(question, ["Option A", "Option Z"]);
      expect(price).toBe(100); // Option Z doesn't exist, so only Option A is counted
    });

    test("handles all selections with varying prices", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B", "Option C", "Option D"],
        prices: [50, 100, 150, 200],
      };

      const price = calculateQuestionPrice(question, ["Option A", "Option B", "Option C", "Option D"]);
      expect(price).toBe(500); // 50 + 100 + 150 + 200
    });

    test("handles prices array shorter than options", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B", "Option C", "Option D"],
        prices: [100, 200], // missing prices for C and D
      };

      const price = calculateQuestionPrice(question, ["Option A", "Option C", "Option D"]);
      expect(price).toBe(100); // Only Option A has a price
    });

    test("returns 0 when receiving string answer", () => {
      const question: QuestionAttributes = {
        ...baseQuestion,
        options: ["Option A", "Option B"],
        prices: [100, 200],
      };

      const price = calculateQuestionPrice(question, "Option A");
      expect(price).toBe(0);
    });
  });

  describe("other question types", () => {
    test("returns 0 for TEXT question type", () => {
      const question: QuestionAttributes = {
        id: "test-id",
        order: 0,
        question: "Test question",
        type: QuestionType.TEXT,
        eventId: "test-event-id",
        required: false,
        public: false,
        options: ["Option A"],
        prices: [100],
      };

      const price = calculateQuestionPrice(question, "Option A");
      expect(price).toBe(0);
    });
  });
});
