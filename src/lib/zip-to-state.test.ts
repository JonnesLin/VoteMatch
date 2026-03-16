import { describe, it, expect } from "vitest";
import { zipToState } from "./zip-to-state";

describe("zipToState", () => {
  it("maps Wisconsin ZIP 53703 to WI", () => {
    expect(zipToState("53703")).toBe("WI");
  });

  it("maps Washington ZIP 98004 to WA", () => {
    expect(zipToState("98004")).toBe("WA");
  });

  it("maps California ZIP 90210 to CA", () => {
    expect(zipToState("90210")).toBe("CA");
  });

  it("maps Illinois ZIP 60601 to IL", () => {
    expect(zipToState("60601")).toBe("IL");
  });

  it("maps New York ZIP 10001 to NY", () => {
    expect(zipToState("10001")).toBe("NY");
  });

  it("maps DC ZIP 20500 to DC", () => {
    expect(zipToState("20500")).toBe("DC");
  });

  it("returns null for invalid ZIP", () => {
    expect(zipToState("00000")).toBeNull();
    expect(zipToState("abc")).toBeNull();
    expect(zipToState("")).toBeNull();
  });
});
