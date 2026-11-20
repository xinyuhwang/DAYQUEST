import { describe, expect, it } from "vitest";
import { isValidTimeZone, normalizeCode, normalizeEmail, safeNextPath } from "./auth";

describe("safeNextPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/focus?task=1")).toBe("/focus?task=1");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", null, 42]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("never sends the user back to the sign-in page", () => {
    expect(safeNextPath("/sign-in")).toBe("/");
    expect(safeNextPath("/sign-in?next=/x")).toBe("/");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases valid addresses", () => {
    expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com");
  });
  it("rejects invalid input", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("normalizeCode", () => {
  it("accepts 6 digits, tolerating spaces and dashes", () => {
    expect(normalizeCode("123456")).toBe("123456");
    expect(normalizeCode("123 456")).toBe("123456");
    expect(normalizeCode("123-456")).toBe("123456");
  });
  it("rejects anything else", () => {
    expect(normalizeCode("12345")).toBeNull();
    expect(normalizeCode("abcdef")).toBeNull();
    expect(normalizeCode(undefined)).toBeNull();
  });
});
