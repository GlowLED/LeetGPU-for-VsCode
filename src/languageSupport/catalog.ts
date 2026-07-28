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

const CUDA_ROUNDING_MODES = [
  ["rd", "round-down"],
  ["rn", "round-to-nearest-even"],
  ["ru", "round-up"],
  ["rz", "round-towards-zero"]
] as const;

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
  keyword("__constant__", "Places a variable in device constant memory."),
  keyword("__managed__", "Declares a variable in CUDA unified memory."),
  keyword("__forceinline__", "Requests that the compiler inline a function."),
  keyword("__launch_bounds__", "Specifies kernel launch bounds for compiler optimization."),
  fn("cudaDeviceSynchronize", "cudaError_t cudaDeviceSynchronize()", "Waits for preceding device work to complete.", "cudaDeviceSynchronize()"),
  fn("cudaGetLastError", "cudaError_t cudaGetLastError()", "Returns and clears the last CUDA runtime error.", "cudaGetLastError()"),
  fn("cudaPeekAtLastError", "cudaError_t cudaPeekAtLastError()", "Returns the last CUDA runtime error without clearing it.", "cudaPeekAtLastError()"),
  fn("cudaGetErrorString", "const char *cudaGetErrorString(cudaError_t error)", "Returns a description of a CUDA runtime error.", "cudaGetErrorString(${1:error})"),
  fn("cudaMalloc", "cudaError_t cudaMalloc(void **ptr, size_t size)", "Allocates device memory.", "cudaMalloc(${1:&ptr}, ${2:size})"),
  fn("cudaFree", "cudaError_t cudaFree(void *ptr)", "Frees device memory.", "cudaFree(${1:ptr})"),
  fn("cudaMemcpy", "cudaError_t cudaMemcpy(void *dst, const void *src, size_t count, cudaMemcpyKind kind)", "Copies memory between host and device address spaces.", "cudaMemcpy(${1:dst}, ${2:src}, ${3:count}, ${4:cudaMemcpyDeviceToDevice})"),
  fn("cudaMemcpyAsync", "cudaError_t cudaMemcpyAsync(void *dst, const void *src, size_t count, cudaMemcpyKind kind, cudaStream_t stream = 0)", "Enqueues a memory copy on a CUDA stream.", "cudaMemcpyAsync(${1:dst}, ${2:src}, ${3:count}, ${4:cudaMemcpyDeviceToDevice}, ${5:stream})"),
  fn("cudaMemset", "cudaError_t cudaMemset(void *ptr, int value, size_t count)", "Initializes device memory.", "cudaMemset(${1:ptr}, ${2:0}, ${3:count})"),
  fn("cudaMemsetAsync", "cudaError_t cudaMemsetAsync(void *ptr, int value, size_t count, cudaStream_t stream = 0)", "Enqueues a memory initialization on a CUDA stream.", "cudaMemsetAsync(${1:ptr}, ${2:0}, ${3:count}, ${4:stream})"),
  fn("cudaStreamCreate", "cudaError_t cudaStreamCreate(cudaStream_t *stream)", "Creates an asynchronous CUDA stream.", "cudaStreamCreate(${1:&stream})"),
  fn("cudaStreamDestroy", "cudaError_t cudaStreamDestroy(cudaStream_t stream)", "Destroys a CUDA stream.", "cudaStreamDestroy(${1:stream})"),
  fn("cudaStreamSynchronize", "cudaError_t cudaStreamSynchronize(cudaStream_t stream)", "Waits for work in a CUDA stream to complete.", "cudaStreamSynchronize(${1:stream})"),
  fn("cudaEventCreate", "cudaError_t cudaEventCreate(cudaEvent_t *event)", "Creates a CUDA event.", "cudaEventCreate(${1:&event})"),
  fn("cudaEventDestroy", "cudaError_t cudaEventDestroy(cudaEvent_t event)", "Destroys a CUDA event.", "cudaEventDestroy(${1:event})"),
  fn("cudaEventRecord", "cudaError_t cudaEventRecord(cudaEvent_t event, cudaStream_t stream = 0)", "Records a CUDA event on a stream.", "cudaEventRecord(${1:event}, ${2:stream})"),
  fn("cudaEventSynchronize", "cudaError_t cudaEventSynchronize(cudaEvent_t event)", "Waits for a CUDA event to complete.", "cudaEventSynchronize(${1:event})"),
  fn("cudaEventElapsedTime", "cudaError_t cudaEventElapsedTime(float *milliseconds, cudaEvent_t start, cudaEvent_t end)", "Computes elapsed time between two CUDA events.", "cudaEventElapsedTime(${1:&milliseconds}, ${2:start}, ${3:end})"),
  ...cudaFastMathFunctions(),
  ...cudaRoundedBinaryFunctions("fadd", "Adds"),
  ...cudaRoundedBinaryFunctions("fdiv", "Divides"),
  ...cudaRoundedTernaryFunctions("fmaf", "Computes a fused multiply-add"),
  ...cudaRoundedBinaryFunctions("fmul", "Multiplies"),
  ...cudaRoundedUnaryFunctions("frcp", "Computes the reciprocal"),
  fn("__frsqrt_rn", "float __frsqrt_rn(float x)", "Computes the reciprocal square root in round-to-nearest-even mode.", "__frsqrt_rn(${1:x})"),
  ...cudaRoundedUnaryFunctions("fsqrt", "Computes the square root"),
  ...cudaRoundedBinaryFunctions("fsub", "Subtracts"),
  fn("__syncthreads", "void __syncthreads()", "Synchronizes all threads in a block.", "__syncthreads()"),
  fn("__syncthreads_count", "int __syncthreads_count(int predicate)", "Synchronizes a block and counts threads for which the predicate is nonzero.", "__syncthreads_count(${1:predicate})"),
  fn("__syncthreads_and", "int __syncthreads_and(int predicate)", "Synchronizes a block and returns whether every predicate is nonzero.", "__syncthreads_and(${1:predicate})"),
  fn("__syncthreads_or", "int __syncthreads_or(int predicate)", "Synchronizes a block and returns whether any predicate is nonzero.", "__syncthreads_or(${1:predicate})"),
  fn("__syncwarp", "void __syncwarp(unsigned mask = 0xffffffff)", "Synchronizes the named lanes in a warp.", "__syncwarp(${1:0xffffffff})"),
  fn("__ballot_sync", "unsigned __ballot_sync(unsigned mask, int predicate)", "Returns a mask of lanes whose predicate is nonzero.", "__ballot_sync(${1:0xffffffff}, ${2:predicate})"),
  fn("__any_sync", "int __any_sync(unsigned mask, int predicate)", "Returns whether any named lane has a nonzero predicate.", "__any_sync(${1:0xffffffff}, ${2:predicate})"),
  fn("__all_sync", "int __all_sync(unsigned mask, int predicate)", "Returns whether every named lane has a nonzero predicate.", "__all_sync(${1:0xffffffff}, ${2:predicate})"),
  fn("__activemask", "unsigned __activemask()", "Returns the mask of currently active lanes.", "__activemask()"),
  fn("__threadfence_block", "void __threadfence_block()", "Orders the calling thread's memory accesses as observed by its block.", "__threadfence_block()"),
  fn("__threadfence", "void __threadfence()", "Orders the calling thread's memory accesses as observed by the device.", "__threadfence()"),
  fn("__threadfence_system", "void __threadfence_system()", "Orders the calling thread's memory accesses as observed by the system.", "__threadfence_system()"),
  fn("atomicAdd", "T atomicAdd(T *address, T value)", "Atomically adds a value.", "atomicAdd(${1:address}, ${2:value})"),
  fn("atomicSub", "T atomicSub(T *address, T value)", "Atomically subtracts a value.", "atomicSub(${1:address}, ${2:value})"),
  fn("atomicMax", "T atomicMax(T *address, T value)", "Atomically stores the maximum.", "atomicMax(${1:address}, ${2:value})"),
  fn("atomicMin", "T atomicMin(T *address, T value)", "Atomically stores the minimum.", "atomicMin(${1:address}, ${2:value})"),
  fn("atomicExch", "T atomicExch(T *address, T value)", "Atomically exchanges a value.", "atomicExch(${1:address}, ${2:value})"),
  fn("atomicCAS", "T atomicCAS(T *address, T compare, T value)", "Atomically performs compare-and-swap.", "atomicCAS(${1:address}, ${2:compare}, ${3:value})"),
  fn("atomicAnd", "T atomicAnd(T *address, T value)", "Atomically applies bitwise AND.", "atomicAnd(${1:address}, ${2:value})"),
  fn("atomicOr", "T atomicOr(T *address, T value)", "Atomically applies bitwise OR.", "atomicOr(${1:address}, ${2:value})"),
  fn("atomicXor", "T atomicXor(T *address, T value)", "Atomically applies bitwise XOR.", "atomicXor(${1:address}, ${2:value})"),
  fn("atomicInc", "unsigned atomicInc(unsigned *address, unsigned limit)", "Atomically increments with wraparound.", "atomicInc(${1:address}, ${2:limit})"),
  fn("atomicDec", "unsigned atomicDec(unsigned *address, unsigned limit)", "Atomically decrements with wraparound.", "atomicDec(${1:address}, ${2:limit})"),
  fn("__shfl_sync", "T __shfl_sync(unsigned mask, T value, int srcLane, int width = warpSize)", "Reads a value from a lane in the warp.", "__shfl_sync(${1:0xffffffff}, ${2:value}, ${3:srcLane})"),
  fn("__shfl_down_sync", "T __shfl_down_sync(unsigned mask, T value, unsigned delta, int width = warpSize)", "Reads a value from a higher-numbered lane.", "__shfl_down_sync(${1:0xffffffff}, ${2:value}, ${3:delta})"),
  fn("__shfl_up_sync", "T __shfl_up_sync(unsigned mask, T value, unsigned delta, int width = warpSize)", "Reads a value from a lower-numbered lane.", "__shfl_up_sync(${1:0xffffffff}, ${2:value}, ${3:delta})"),
  fn("__shfl_xor_sync", "T __shfl_xor_sync(unsigned mask, T value, int laneMask, int width = warpSize)", "Reads a value from a lane selected by XORing the lane ID.", "__shfl_xor_sync(${1:0xffffffff}, ${2:value}, ${3:laneMask})"),
  fn("__match_any_sync", "unsigned __match_any_sync(unsigned mask, T value)", "Returns the mask of lanes with a matching value.", "__match_any_sync(${1:0xffffffff}, ${2:value})"),
  fn("__match_all_sync", "unsigned __match_all_sync(unsigned mask, T value, int *predicate)", "Returns the matching-lane mask and whether all named lanes match.", "__match_all_sync(${1:0xffffffff}, ${2:value}, ${3:&predicate})"),
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

export function completionSymbolsFor(
  language: string,
  namespace?: string,
  semanticCudaCompletions = false
): readonly LanguageSymbol[] {
  const symbols = symbolsFor(language, namespace);
  return language === "cuda" && semanticCudaCompletions
    ? symbols.filter((candidate) => candidate.kind === "snippet")
    : symbols;
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

function cudaFastMathFunctions(): LanguageSymbol[] {
  return [
    fn("__cosf", "float __cosf(float x)", "Calculates a fast approximate cosine.", "__cosf(${1:x})"),
    fn("__exp10f", "float __exp10f(float x)", "Calculates a fast approximate base-10 exponential.", "__exp10f(${1:x})"),
    fn("__expf", "float __expf(float x)", "Calculates a fast approximate base-e exponential.", "__expf(${1:x})"),
    fn("__fdividef", "float __fdividef(float x, float y)", "Calculates a fast approximate division.", "__fdividef(${1:x}, ${2:y})"),
    fn("__log10f", "float __log10f(float x)", "Calculates a fast approximate base-10 logarithm.", "__log10f(${1:x})"),
    fn("__log2f", "float __log2f(float x)", "Calculates a fast approximate base-2 logarithm.", "__log2f(${1:x})"),
    fn("__logf", "float __logf(float x)", "Calculates a fast approximate natural logarithm.", "__logf(${1:x})"),
    fn("__powf", "float __powf(float x, float y)", "Calculates a fast approximate power.", "__powf(${1:x}, ${2:y})"),
    fn("__saturatef", "float __saturatef(float x)", "Clamps a value to the interval [0, 1].", "__saturatef(${1:x})"),
    fn("__sincosf", "void __sincosf(float x, float *sine, float *cosine)", "Calculates fast approximate sine and cosine values.", "__sincosf(${1:x}, ${2:&sine}, ${3:&cosine})"),
    fn("__sinf", "float __sinf(float x)", "Calculates a fast approximate sine.", "__sinf(${1:x})"),
    fn("__tanf", "float __tanf(float x)", "Calculates a fast approximate tangent.", "__tanf(${1:x})")
  ];
}

function cudaRoundedBinaryFunctions(operation: string, description: string): LanguageSymbol[] {
  return CUDA_ROUNDING_MODES.map(([suffix, mode]) => {
    const label = `__${operation}_${suffix}`;
    return fn(label, `float ${label}(float x, float y)`, `${description} two values in ${mode} mode.`, `${label}(\${1:x}, \${2:y})`);
  });
}

function cudaRoundedTernaryFunctions(operation: string, description: string): LanguageSymbol[] {
  return CUDA_ROUNDING_MODES.map(([suffix, mode]) => {
    const label = `__${operation}_${suffix}`;
    return fn(label, `float ${label}(float x, float y, float z)`, `${description} in ${mode} mode.`, `${label}(\${1:x}, \${2:y}, \${3:z})`);
  });
}

function cudaRoundedUnaryFunctions(operation: string, description: string): LanguageSymbol[] {
  return CUDA_ROUNDING_MODES.map(([suffix, mode]) => {
    const label = `__${operation}_${suffix}`;
    return fn(label, `float ${label}(float x)`, `${description} in ${mode} mode.`, `${label}(\${1:x})`);
  });
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
