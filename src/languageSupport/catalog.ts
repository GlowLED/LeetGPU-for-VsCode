export type LeetGpuLanguage = "cuda" | "triton" | "pytorch" | "jax" | "cute" | "mojo";
export type SymbolKind = "class" | "constant" | "function" | "keyword" | "snippet";

export interface LanguageSymbol {
  label: string;
  namespace?: string;
  kind: SymbolKind;
  detail: string;
  documentation: string;
  insertText?: string;
  signature?: string;
}

const cuda: LanguageSymbol[] = [
  value("threadIdx", "CUDA built-in thread index", "Coordinates of the current thread within its block."),
  value("blockIdx", "CUDA built-in block index", "Coordinates of the current block within the grid."),
  value("blockDim", "CUDA built-in block dimensions", "Dimensions of the current block."),
  value("gridDim", "CUDA built-in grid dimensions", "Dimensions of the launch grid."),
  value("warpSize", "CUDA warp width", "Number of threads in a CUDA warp."),
  keyword("__global__", "Declares a kernel launched from the host."),
  keyword("__device__", "Declares a function that runs on the device."),
  keyword("__host__", "Declares a function that runs on the host."),
  keyword("__shared__", "Places a variable in per-block shared memory."),
  fn("cudaDeviceSynchronize", "cudaError_t cudaDeviceSynchronize()", "Waits for preceding device work to complete.", "cudaDeviceSynchronize()"),
  fn("cudaGetLastError", "cudaError_t cudaGetLastError()", "Returns and clears the last CUDA runtime error.", "cudaGetLastError()"),
  fn("cudaMalloc", "cudaError_t cudaMalloc(void **ptr, size_t size)", "Allocates device memory.", "cudaMalloc(${1:&ptr}, ${2:size})"),
  fn("cudaFree", "cudaError_t cudaFree(void *ptr)", "Frees device memory.", "cudaFree(${1:ptr})"),
  fn("cudaMemcpy", "cudaError_t cudaMemcpy(void *dst, const void *src, size_t count, cudaMemcpyKind kind)", "Copies memory between host and device address spaces.", "cudaMemcpy(${1:dst}, ${2:src}, ${3:count}, ${4:cudaMemcpyDeviceToDevice})"),
  fn("cudaMemset", "cudaError_t cudaMemset(void *ptr, int value, size_t count)", "Initializes device memory.", "cudaMemset(${1:ptr}, ${2:0}, ${3:count})"),
  fn("__syncthreads", "void __syncthreads()", "Synchronizes all threads in a block.", "__syncthreads()"),
  fn("atomicAdd", "T atomicAdd(T *address, T value)", "Atomically adds a value.", "atomicAdd(${1:address}, ${2:value})"),
  fn("atomicMax", "T atomicMax(T *address, T value)", "Atomically stores the maximum.", "atomicMax(${1:address}, ${2:value})"),
  fn("__shfl_sync", "T __shfl_sync(unsigned mask, T value, int srcLane, int width = warpSize)", "Reads a value from a lane in the warp.", "__shfl_sync(${1:0xffffffff}, ${2:value}, ${3:srcLane})"),
  fn("__shfl_down_sync", "T __shfl_down_sync(unsigned mask, T value, unsigned delta, int width = warpSize)", "Reads a value from a higher-numbered lane.", "__shfl_down_sync(${1:0xffffffff}, ${2:value}, ${3:delta})"),
  {
    label: "kernel",
    kind: "snippet",
    detail: "CUDA kernel and solve entry point",
    documentation: "Creates a LeetGPU-compatible kernel launch skeleton.",
    insertText: "__global__ void ${1:kernel}(const float* input, float* output, int N) {\n    int i = blockIdx.x * blockDim.x + threadIdx.x;\n    if (i < N) {\n        ${0}\n    }\n}\n\nextern \"C\" void solve(const float* input, float* output, int N) {\n    int threads = 256;\n    int blocks = (N + threads - 1) / threads;\n    ${1:kernel}<<<blocks, threads>>>(input, output, N);\n    cudaDeviceSynchronize();\n}"
  }
];

const triton: LanguageSymbol[] = [
  nsFn("jit", "triton", "triton.jit(fn=None, **kwargs)", "Compiles a function as a Triton JIT function.", "jit"),
  nsFn("cdiv", "triton", "triton.cdiv(x, div)", "Computes ceiling division.", "cdiv(${1:x}, ${2:div})"),
  nsFn("autotune", "triton", "triton.autotune(configs, key)", "Selects a launch configuration using autotuning."),
  nsValue("Config", "triton", "class", "triton.Config(kwargs, num_warps=4, num_stages=3)", "Describes a Triton launch configuration."),
  nsValue("constexpr", "tl", "class", "tl.constexpr", "Marks a value as known at compile time."),
  ...tlFunctions(["program_id", "num_programs", "arange", "load", "store", "atomic_add", "zeros", "full", "sum", "max", "min", "maximum", "minimum", "where", "exp", "log", "sqrt", "sigmoid", "dot"]),
  ...["float16", "float32", "float64", "int32", "int64", "uint32", "uint64"].map((name) =>
    nsValue(name, "tl", "constant", `tl.${name}`, `Triton ${name} dtype.`)
  )
];

const torch: LanguageSymbol[] = [
  nsValue("Tensor", "torch", "class", "torch.Tensor", "Multidimensional tensor type."),
  ...["Module", "Linear", "ReLU", "GELU", "Sequential"].map((name) =>
    nsValue(name, "nn", "class", `nn.${name}`, `Torch neural-network ${name} type.`)
  ),
  ...pythonFunctions("torch", ["empty", "zeros", "ones", "full", "rand", "randn", "tensor", "empty_like", "zeros_like", "ones_like", "full_like", "arange", "exp", "log", "sqrt", "sigmoid", "relu", "tanh", "sum", "mean", "max", "min", "cumsum", "softmax", "matmul", "clamp", "where"]),
  ...["float16", "float32", "float64", "int8", "int32", "int64", "uint8", "bool"].map((name) =>
    nsValue(name, "torch", "constant", `torch.${name}`, `Torch ${name} dtype.`)
  )
];

const jax: LanguageSymbol[] = [
  nsValue("Array", "jax", "class", "jax.Array", "JAX multidimensional array type."),
  nsFn("jit", "jax", "jax.jit(fun, **kwargs)", "JIT-compiles a JAX function.", "jit"),
  nsFn("vmap", "jax", "jax.vmap(fun, in_axes=0, out_axes=0)", "Vectorizes a function across array axes."),
  ...pythonFunctions("jnp", ["array", "asarray", "empty", "zeros", "ones", "full", "arange", "zeros_like", "full_like", "exp", "log", "sqrt", "tanh", "sum", "mean", "max", "min", "cumsum", "maximum", "minimum", "where", "matmul"]),
  ...["float16", "float32", "float64", "int32", "int64", "uint32"].map((name) =>
    nsValue(name, "jnp", "constant", `jnp.${name}`, `JAX ${name} dtype.`)
  )
];

const cute: LanguageSymbol[] = [
  nsFn("jit", "cute", "cute.jit(fn)", "JIT-compiles a CuTe DSL function.", "jit"),
  ...["Tensor", "Int32", "Uint32", "Float32"].map((name) => nsValue(name, "cute", "class", `cute.${name}`, `CuTe ${name} type.`)),
  ...pythonFunctions("cute", ["ceil_div", "make_layout", "make_tensor", "copy", "gemm"])
];

const mojo: LanguageSymbol[] = [
  nsValue("DeviceContext", undefined, "class", "Mojo GPU device context", "Owns a GPU device and launches kernels."),
  fn("block_dim", "block_dim()", "Returns the current GPU block dimensions.", "block_dim()"),
  fn("block_idx", "block_idx()", "Returns the current GPU block index.", "block_idx()"),
  fn("thread_idx", "thread_idx()", "Returns the current GPU thread index.", "thread_idx()"),
  nsValue("UnsafePointer", undefined, "class", "UnsafePointer[T]", "A typed pointer used by LeetGPU entry points."),
  fn("ceildiv", "ceildiv[T](lhs: T, rhs: T) -> T", "Computes ceiling division.", "ceildiv(${1:value}, ${2:divisor})"),
  {
    label: "mojo imports",
    kind: "snippet",
    detail: "LeetGPU Mojo imports",
    documentation: "Imports the GPU helpers used by current LeetGPU starters.",
    insertText: "from std.gpu.host import DeviceContext\nfrom std.gpu import block_dim, block_idx, thread_idx\nfrom std.memory import UnsafePointer\nfrom std.math import ceildiv\n"
  }
];

export const LANGUAGE_SYMBOLS: Record<LeetGpuLanguage, readonly LanguageSymbol[]> = {
  cuda,
  triton: [...triton, ...torch],
  pytorch: torch,
  jax,
  cute,
  mojo
};

export function symbolsFor(language: string, namespace?: string): readonly LanguageSymbol[] {
  if (!isLeetGpuLanguage(language)) return [];
  return namespace ? LANGUAGE_SYMBOLS[language].filter((candidate) => candidate.namespace === namespace) : LANGUAGE_SYMBOLS[language];
}

export function findSymbol(language: string, name: string): LanguageSymbol | undefined {
  if (!isLeetGpuLanguage(language)) return undefined;
  const normalized = name.replace(/^.*\./, "");
  return LANGUAGE_SYMBOLS[language].find((candidate) => candidate.label === normalized);
}

export function isLeetGpuLanguage(language: string): language is LeetGpuLanguage {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_SYMBOLS, language);
}

function value(label: string, detail: string, documentation: string): LanguageSymbol {
  return { label, kind: "constant", detail, documentation };
}

function keyword(label: string, documentation: string): LanguageSymbol {
  return { label, kind: "keyword", detail: "CUDA keyword", documentation };
}

function fn(label: string, signature: string, documentation: string, insertText?: string): LanguageSymbol {
  return { label, kind: "function", detail: signature, signature, documentation, insertText };
}

function nsFn(label: string, namespace: string, signature: string, documentation: string, insertText?: string): LanguageSymbol {
  return { ...fn(label, signature, documentation, insertText), namespace };
}

function nsValue(label: string, namespace: string | undefined, kind: SymbolKind, detail: string, documentation: string): LanguageSymbol {
  return { label, namespace, kind, detail, documentation };
}

function tlFunctions(names: string[]): LanguageSymbol[] {
  return names.map((name) => nsFn(name, "tl", `tl.${name}(*args, **kwargs)`, `Applies Triton language operation ${name}.`, `${name}(\${1:value})`));
}

function pythonFunctions(namespace: string, names: string[]): LanguageSymbol[] {
  return names.map((name) => nsFn(name, namespace, `${namespace}.${name}(*args, **kwargs)`, `Applies ${namespace}.${name}.`, `${name}(\${1:value})`));
}
