import { describe, expect, test } from "bun:test";
import { messageForStatus } from "../../services/notification-service/src/notification-logic";

describe("notification-logic", () => {
  test("messageForStatus returns Swedish messages for known statuses", () => {
    expect(messageForStatus("pending")).toContain("mottagits");
    expect(messageForStatus("preparing")).toContain("tillagas");
    expect(messageForStatus("ready")).toContain("klar");
    expect(messageForStatus("completed")).toContain("Tack");
  });

  test("messageForStatus returns null for unknown status", () => {
    expect(messageForStatus("cancelled")).toBeNull();
  });
});
