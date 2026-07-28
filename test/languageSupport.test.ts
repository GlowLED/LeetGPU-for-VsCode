import { describe, expect, it } from "vitest";
import { SUPPORT_ASSETS } from "../src/languageSupport/assets";
import { completionSymbolsFor, findSymbol, LANGUAGE_SYMBOLS, symbolsFor } from "../src/languageSupport/catalog";
import { addUnique, removeValues, withBooleanEntry } from "../src/utils/configuration";

describe("offline language support", () => {
  it("covers every LeetGPU language", () => {
    expect(Object.keys(LANGUAGE_SYMBOLS).sort()).toEqual(["cuda", "cute", "jax", "mojo", "pytorch", "triton"]);
    for (const symbols of Object.values(LANGUAGE_SYMBOLS)) expect(symbols.length).toBeGreaterThan(4);
  });

  it("filters member completions by the imported alias", () => {
    expect(symbolsFor("triton", "tl").some((symbol) => symbol.label === "program_id")).toBe(true);
    expect(symbolsFor("triton", "torch").some((symbol) => symbol.label === "Tensor")).toBe(true);
    expect(symbolsFor("pytorch", "nn").some((symbol) => symbol.label === "Linear")).toBe(true);
    expect(symbolsFor("jax", "jnp").some((symbol) => symbol.label === "zeros")).toBe(true);
    expect(symbolsFor("cute", "cute").some((symbol) => symbol.label === "Tensor")).toBe(true);
    expect(findSymbol("cuda", "cudaDeviceSynchronize")?.signature).toContain("cudaDeviceSynchronize");
  });

  it("avoids duplicate CUDA fallback completions when C/C++ IntelliSense is available", () => {
    expect(completionSymbolsFor("cuda").some((symbol) => symbol.label === "__expf")).toBe(true);
    expect(completionSymbolsFor("cuda", undefined, true).some((symbol) => symbol.label === "__expf")).toBe(false);
    expect(completionSymbolsFor("cuda", undefined, true).map((symbol) => symbol.label)).toEqual(["kernel"]);
  });

  it("ships the headers and import roots used by current starters", () => {
    const paths = new Set(SUPPORT_ASSETS.map((asset) => asset.path));
    expect(paths).toContain("cuda/include/cuda_runtime.h");
    expect(paths).toContain("cuda/include/cuda_fp16.h");
    expect(paths).toContain("python/torch/__init__.pyi");
    expect(paths).toContain("python/triton/language/__init__.pyi");
    expect(paths).toContain("python/jax/numpy/__init__.pyi");
    expect(paths).toContain("python/cutlass/cute/__init__.pyi");
    expect(paths).toContain("mojo/gpu/host.mojo");
    expect(paths).toContain("mojo/gpu/id.mojo");
    expect(paths).toContain("mojo/memory.mojo");
    expect(paths).toContain("mojo/math.mojo");
  });

  it("pairs Python stubs with placeholder sources to avoid missing-module-source diagnostics", () => {
    const paths = new Set(SUPPORT_ASSETS.map((asset) => asset.path));
    for (const path of paths) {
      if (path.endsWith(".pyi")) expect(paths).toContain(path.slice(0, -1));
    }
  });

  it("keeps unfinished JAX starter return annotations permissive", () => {
    const jax = SUPPORT_ASSETS.find((asset) => asset.path === "python/jax/__init__.pyi")?.content ?? "";
    expect(jax).toContain("Array: TypeAlias = Any");
  });

  it("provides core CUDA declarations", () => {
    const runtime = SUPPORT_ASSETS.find((asset) => asset.path.endsWith("cuda_runtime.h"))?.content ?? "";
    for (const identifier of [
      "threadIdx",
      "blockIdx",
      "blockDim",
      "__cudaPushCallConfiguration",
      "cudaDeviceSynchronize",
      "atomicAdd",
      "__shfl_down_sync"
    ]) {
      expect(runtime).toContain(identifier);
    }
    expect(runtime).toContain("size_t sharedMem = 0");
    expect(runtime).toContain("void *stream = 0");
  });

  it("provides CUDA single-precision device intrinsics", () => {
    const runtime = SUPPORT_ASSETS.find((asset) => asset.path.endsWith("cuda_runtime.h"))?.content ?? "";
    const intrinsics = [
      "__cosf",
      "__exp10f",
      "__expf",
      "__fdividef",
      "__fmaf_rn",
      "__frcp_rn",
      "__frsqrt_rn",
      "__fsqrt_rn",
      "__log10f",
      "__log2f",
      "__logf",
      "__powf",
      "__saturatef",
      "__sincosf",
      "__sinf",
      "__tanf"
    ];

    for (const identifier of intrinsics) {
      expect(runtime).toContain(identifier);
      expect(findSymbol("cuda", identifier)?.signature).toContain(identifier);
    }
    for (const operation of ["fadd", "fdiv", "fmaf", "fmul", "frcp", "fsqrt", "fsub"]) {
      for (const mode of ["rd", "rn", "ru", "rz"]) {
        const identifier = `__${operation}_${mode}`;
        expect(runtime).toContain(identifier);
        expect(findSymbol("cuda", identifier)?.signature).toContain(identifier);
      }
    }
  });

  it("provides common CUDA synchronization, warp, and atomic operations", () => {
    const runtime = SUPPORT_ASSETS.find((asset) => asset.path.endsWith("cuda_runtime.h"))?.content ?? "";
    for (const identifier of [
      "__syncthreads_count",
      "__syncthreads_and",
      "__syncthreads_or",
      "__syncwarp",
      "__ballot_sync",
      "__activemask",
      "__threadfence",
      "__shfl_up_sync",
      "__shfl_xor_sync",
      "__match_any_sync",
      "atomicSub",
      "atomicCAS",
      "atomicAnd",
      "atomicInc"
    ]) {
      expect(runtime).toContain(identifier);
      expect(findSymbol("cuda", identifier)?.signature).toContain(identifier);
    }
  });

  it("provides common CUDA stream and event operations", () => {
    const runtime = SUPPORT_ASSETS.find((asset) => asset.path.endsWith("cuda_runtime.h"))?.content ?? "";
    for (const identifier of [
      "cudaPeekAtLastError",
      "cudaMemcpyAsync",
      "cudaMemsetAsync",
      "cudaStreamCreate",
      "cudaStreamDestroy",
      "cudaStreamSynchronize",
      "cudaEventCreate",
      "cudaEventDestroy",
      "cudaEventRecord",
      "cudaEventSynchronize",
      "cudaEventElapsedTime"
    ]) {
      expect(runtime).toContain(identifier);
      expect(findSymbol("cuda", identifier)?.signature).toContain(identifier);
    }
  });
});

describe("managed configuration helpers", () => {
  it("adds paths without duplicates", () => {
    expect(addUnique(["user", "support"], ["support"])).toEqual(["user", "support"]);
  });

  it("removes only extension-owned values", () => {
    expect(removeValues(["user", "old-support"], ["old-support"])).toEqual(["user"]);
  });

  it("preserves existing exclude entries", () => {
    expect(withBooleanEntry({ build: true }, "leetgpu/.support", true)).toEqual({
      build: true,
      "leetgpu/.support": true
    });
  });
});
