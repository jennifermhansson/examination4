import { describe, expect, test } from "bun:test";
import { isValidStatusTransition } from "../../services/kitchen-service/src/kitchen-logic";

describe("kitchen status transitions", () => {
  test("pending can move to preparing", () => {
    expect(isValidStatusTransition("pending", "preparing")).toBe(true);
  });

  test("preparing can move to ready", () => {
    expect(isValidStatusTransition("preparing", "ready")).toBe(true);
  });

  test("ready can move to completed", () => {
    expect(isValidStatusTransition("ready", "completed")).toBe(true);
  });

  test("pending cannot skip to ready", () => {
    expect(isValidStatusTransition("pending", "ready")).toBe(false);
  });

  test("completed cannot transition further", () => {
    expect(isValidStatusTransition("completed", "preparing")).toBe(false);
  });
});
