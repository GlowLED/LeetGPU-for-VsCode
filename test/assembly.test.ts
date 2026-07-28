import { describe, expect, it } from "vitest";
import { assemblyResponseSchema } from "../src/models";

describe("assembly response", () => {
  it("accepts PTX and SASS output", () => {
    expect(assemblyResponseSchema.parse({ ptx: ".version 8.7", sass: "EXIT ;" }))
      .toEqual({ ptx: ".version 8.7", sass: "EXIT ;" });
  });

  it("rejects incomplete assembly output", () => {
    expect(() => assemblyResponseSchema.parse({ ptx: ".version 8.7" })).toThrow();
    expect(() => assemblyResponseSchema.parse({ ptx: 1, sass: "EXIT ;" })).toThrow();
  });
});
