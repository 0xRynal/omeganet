# Omeganet

A **roblox-ts** library for local signals, remotes, parallel (Actors), observables, and middleware (validation, rate limiting, etc.) with strict typing.

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Feature tour (examples)](#feature-tour)
- [Public API reference](#public-api-reference)
- [CLI](#cli)
- [Architecture](#architecture)
- [Conventions](#conventions-repo)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

```bash
npm install @rbxts/omeganet
```

Optional peer dependencies (only install what you use):

```bash
npm install @flamework/core          # Flamework Service/Controller integration
npm install @rbxts/fusion            # reactive UI bindings
npm install @rbxts/react             # React hooks
```

---

## Quick Start

```typescript
import { Omeganet as Facade } from "@rbxts/omeganet";

const onPlayerJoin = Facade.Omega.create<(player: Player) => void>({
  name: "onPlayerJoin",
  mode: "auto",
});

onPlayerJoin.connect((player) => {
  print(`Welcome ${player.Name}!`);
});

onPlayerJoin.fire(somePlayer);
```

For this minimal flow you do not need to wire up a RemoteEvent by hand.

---

## Feature Tour

### 1. Unified declaration with `Facade.Omega.create`

```typescript
const damage = Facade.Omega.create<(targetId: number, amount: number) => void>({
  name: "dealDamage",
  mode: "auto",              // local | remote | parallel detected automatically
  reliability: "reliable",   // or "unreliable"
  batch: true,               // accumulate fires and flush on Heartbeat
  compression: "rle",        // or "none" or a custom Compressor
  schema: [schema.number(0), schema.number(0, 100)],
});
```

### 2. Middleware chain with 9 built-ins

```typescript
import {
  rateLimit, validate, auth, antiExploit,
  log, metrics, circuitBreaker, debounce, throttle,
} from "@rbxts/omeganet";

damage
  .use(auth({ serverOnly: false }))
  .use(rateLimit({ perSecond: 10, burst: 20 }))
  .use(antiExploit({ maxPerSecond: 30 }))
  .use(validate({ schemas: [schema.number(0), schema.number(0, 100)] }))
  .use(log({ level: "info", includeArgs: true }));
```

Custom middleware is a function `(ctx, proceed) => void | Promise<void>`:

```typescript
damage.use({
  priority: 50,
  name: "myLogger",
  handler: (ctx, proceed) => {
    print(`fired by ${ctx.sender?.Name ?? "server"}`);
    proceed();
  },
});
```

### 3. Remote networking with batching & compression

```typescript
const clientEvent = Facade.Omega.create<(text: string) => void>({
  name: "chatMessage",
  mode: "remote",
  batch: true,
  batchWindow: 1 / 30,
  batchMaxSize: 50,
  compression: "rle",
});

// Client:
clientEvent.fire("hello");

// Server (validate + handle):
clientEvent
  .use(rateLimit({ perSecond: 5 }))
  .use(validate({ schemas: [schema.string(140)] }))
  .connect((text) => { /* ... */ });
```

Unreliable variant:

```typescript
const position = Facade.Omega.create<(pos: Vector3) => void>({
  name: "playerPosition",
  mode: "remote",
  reliability: "unreliable",
  batch: true,
});
```

### 4. Parallel — Actor pool and SharedState

```typescript
import { SharedState } from "@rbxts/omeganet";

const simulation = Facade.Omega.create<(id: number, dt: number) => void>({
  name: "entitySimulation",
  mode: "parallel",
  parallel: true,
  parallelPoolSize: 8,   // up to 64
});

const world = new SharedState<{ tick: number }>({
  name: "world",
  initial: { tick: 0 },
});

world.subscribe<number>("tick", (tick) => print(`tick=${tick}`));

world.racer.onRace((path, writers) => {
  warn(`race on ${path} between ${writers.join(",")}`);
});

simulation.fireParallel(42, 1 / 60);
world.set("tick", 1, "mainActor");
```

### 5. Reactive Observables (RxJS-light)

```typescript
import {
  Observable, BehaviorSubject,
  map, filter, debounceOp, throttleOp,
  distinctUntilChanged, switchMap, combineLatest,
  createSignalValue, createSignalEffect,
} from "@rbxts/omeganet";

const input$ = inputSignal.asObservable();

const search$ = input$.pipe(
  map<[string], string>((args) => args[0]),
  debounceOp<string>(0.3),
  distinctUntilChanged<string>(),
);

search$.subscribe((text) => print(`query: ${text}`));

// Fusion / React / Charm friendly binding:
const score = new BehaviorSubject(0);
const scoreBinding = createSignalValue(0, score);
print(scoreBinding.get());
scoreBinding.subscribe((v) => print(v));
```

### 6. Prediction & Reconciliation

```typescript
import { Reconciler } from "@rbxts/omeganet";

type Input = { forward: boolean };
type State = { x: number };

const reconciler = new Reconciler<State, Input>({
  initialState: { x: 0 },
  apply: (s, input, dt) => ({ x: s.x + (input.forward ? 10 * dt : 0) }),
  equals: (a, b) => math.abs(a.x - b.x) < 0.01,
});

// Client predicts:
const { state, seq } = reconciler.predict({ forward: true }, 1 / 60);

// Server reconciles:
reconciler.reconcile(authoritativeStateFromServer, lastProcessedSeq);
```

### 7. Runtime analysis (`algo`) and DevTools

Deterministic rules over `Collector` stats. Add custom rules and, optionally, a `HintProvider` to format a text report (your own implementation).

```typescript
import { Collector, DevToolsStream, mountStudioPanel } from "@rbxts/omeganet";
// Reuse `Facade` from previous examples

const suggestions = Facade.Omega.algo.analyze();
for (const s of suggestions) {
  print(`[${s.severity}] ${s.rule}: ${s.message}`);
}

Facade.Omega.algo.addRule((stats) => {
  if (stats.fires > 10_000) {
    return {
      severity: "warn",
      signalName: stats.name,
      rule: "lifetime-hot-signal",
      message: `Signal fired ${stats.fires} times — review retention`,
      timestamp: os.clock(),
    };
  }
  return undefined;
});

Facade.Omega.algo.setProvider({
  ask: async (context, stats) => formatReport(context, stats),
});
const report = await Facade.Omega.algo("networking");

DevToolsStream.connect((event) => print(event.kind, event.name));
// mountStudioPanel(plugin);
```

### 8. Testing utilities

```typescript
import { MockSignal, simulate, takeSnapshot } from "@rbxts/omeganet";

const mock = new MockSignal<(n: number) => void>("test");
mock.fire(42);
expect(mock.fireCount()).to.equal(1);
expect(mock.lastFireArgs()?.[0]).to.equal(42);

const report = simulate(realSignal, {
  clients: 100,
  firesPerSecond: 30,
  duration: 2,
  argsFactory: (i) => [i, "hello"],
});
print(report.totalFires);

const snap = takeSnapshot();
```

---

## Public API reference

Everything below is exported from `@rbxts/omeganet` (see `src/index.ts`). Types are in `out/*.d.ts` after `npm run build`.

### Facade (export principal)

- **`Facade.Omega.create<T>(options)`** — Returns an **`OmegaSignal<T>`** (see [Omega options](#facadeomegacreate-options)). This is the main entry for local / remote / parallel unified signals.
- **`Facade.Omega.algo`** — **`HeuristicRuntime`**: `analyze()`, `addRule()`, `setProvider()`, and callable `(context: string) => Promise<string>` for formatted reports. Same object as exported **`HeuristicAnalyzer`**.

### Core (`Signal`, threading)

- **`Signal<T>`** — Luau-friendly signal with `connect`, `once`, `fire`, `wait`, pooling, naming. Used internally and for advanced use.
- **`signal<T>(options?)`** — Factory returning **`Signal<T>`** (same as `new Signal` with options).
- **`Connection`**, **`asConnection`** — Connection handle helpers.
- **`spawnWithPool`**, **`poolSize`**, **`clearPool`** — Recycle coroutine threads when running many short jobs (see `core/ThreadPool`).
- **Types**: `SignalConnection`, `ReadonlySignal`, `SignalCallback`, `SignalOptions`, `InferArgs`, `InferReturn`.

### Event bus

- **`createEventBus<Events>(options?)`** — Typed multi-channel hub: **`on`**, **`once`**, **`off`**, **`emit`**, **`wait`**, **`listenerCount`**, **`clear`**. Each event name is backed by a `Signal` named `bus:<event>`.

### Scope (lifecycle)

- **`createScope()`** — Returns a **`Scope`**: **`signal()`** (tracked `Signal` instances), **`track`** / **`trackAll`** (connections, subscriptions, RBX connections, teardown fns, `destroy`/`dispose` objects), **`dispose()`**, **`child()`** nested scopes, **`isDisposed`**, **`size`**.

### Middleware

- **`MiddlewareChain`** — Programmatic chain (priority-sorted `use`, `execute` / `executeSync`, `remove`, `clear`, `size`).
- **Built-ins** (see [table below](#built-in-middlewares-1)): `rateLimit`, `validate`, `auth`, `antiExploit`, `log`, `metrics`, `circuitBreaker`, `debounce`, `throttle` (and re-exports from `middleware/builtins`).
- **Types**: `MiddlewareContext`, `MiddlewareEntry`, `MiddlewareHandler`.

### Remote layer

- **`RemoteSignal<T>`** — Low-level RemoteEvent wrapper (folder under `ReplicatedStorage`, batching, compression, schema). **`Facade.Omega.create` with `mode: "remote"`** uses this internally; use the class directly only if you need fine control.
- **`RemoteFunctionX<TArgs, TReturn>`** — Typed **`RemoteFunction`** under an internal `ReplicatedStorage` folder. **`invokeServer`** (client), **`invokeClient`** / **`setServerHandler`** (server), **`setClientHandler`** (client), **`destroy`**.
- **`Reconciler<State, Input>`** — Client prediction / server reconciliation (`predict`, `reconcile`, configurable `apply` / `equals`).
- **`rleCompressor`**, **`noCompressor`** — Built-in payload compressors; custom **`Compressor`** type in `remote/types`.
- **`schema`** (`S` from Validator) — **`schema.number`**, **`schema.string`**, **`schema.boolean`**, **`schema.instanceOf`**, **`schema.player`**, **`schema.vector3`**, `parse` / `safeParse` compatible **`SchemaLike<T>`**.
- **Types**: `RemoteSignalOptions`, `Reliability`, `Compressor`, `CompressorOption`.

**Note:** **`Batcher`** exists in `src/remote` and is used internally by remote batching; it is not re-exported from the package index. Import from deep path only if you need it.

### Parallel

- **`ActorPool`** — Named pool of **`Actor`** instances (default internal folder, 1–64 actors). **`send`**, **`sendTo`**, **`destroy`**.
- **`SharedState<T>`** — Cross-actor shared keys with **`get`**, **`set`**, **`subscribe`**, race reporting via **`racer`** (**`RaceDetector`**).
- **`RaceDetector`** — Standalone detector: **`recordWrite`**, **`onRace`**, **`destroy`** (fires when two writers touch the same path in one Heartbeat window).
- **Types**: `ActorPoolOptions`, `SharedStateOptions`, `Unsubscribe`.

### Reactive (Rx-style)

- **`Observable`**, **`of`**, **`fromArray`**, **`fromSignal`**, **`interval`** — Base types and factories.
- **`Subject`**, **`BehaviorSubject`** — Multicast / last-value subjects.
- **Operators**: `map`, `filter`, `take`, `takeUntil`, **`debounceOp`**, **`throttleOp`**, `distinctUntilChanged`, `startWith`, `switchMap`, `merge`, `combineLatest`, `tap`.
- **`createSignalValue`**, **`createSignalEffect`** — Hooks-style helpers for Fusion/React-style bindings (`reactive/hooks`).
- **Types**: `ObservableLike`, `Observer`, `Operator`, `Subscriber`, `Subscription`, `Teardown`.

### Analysis & DevTools

- **`HeuristicAnalyzer`** — Same as **`Facade.Omega.algo`** (runtime suggestions from **`Collector`** stats + custom **`Rule`** functions).
- **`defaultRules`**, **`Rule`**, **`Suggestion`**, **`SuggestionSeverity`** — Rule engine types.
- **`HintProvider`** — `{ ask(context, stats) => Promise<string> }` for custom report formatting.
- **`Collector`** — Tracks per-signal stats (`getAllStats`, used by algo).
- **`DevToolsStream`** — `Signal` of **`DevToolsEvent`** (`fire` | `abort` | `track` | `untrack`).
- **`mountStudioPanel(plugin)`** — Dock widget for Studio plugins (see `devtools/studioPlugin.ts`).
- **Types**: `SignalStats`, `DevToolsEvent`, `StudioPanelHandle`.

### Testing

- **`MockSignal<T>`** — Record fires, assert counts/args (no real `wait`; use history helpers).
- **`simulate`**, **`SimulatorOptions`**, **`SimulationReport`** — Load-style simulation over a signal.
- **`takeSnapshot`**, **`Snapshot`** — Capture **`Collector`** stats at a point in time.
- **`serialize`**, **`assertMatches`** — JSON snapshot compare (approximate `firesPerSecond`).

### Common utilities

- **`Result`**, **`ok`**, **`err`**, **`isOk`**, **`isErr`**, **`unwrap`**, **`unwrapOr`**, **`mapResult`**, **`mapErr`**, **`toError`**, and the exported custom error type — Lightweight Result utilities (not full `neverthrow`; see `common/Result`).
- **`assertNever`**, **`safeParseToResult`** — Exhaustiveness and schema → Result adapter.
- **Branded IDs**: `SignalName`, `PoolName`, `StateName`, `RuleId`, **`asSignalName`**, **`asPoolName`**, **`asStateName`**, **`asRuleId`**.

### `Facade.Omega.create` options

| Option             | Type                                   | Default    | Notes |
| ------------------ | -------------------------------------- | ---------- | ----- |
| `name`             | `string`                               | —          | Required. Unique signal id. |
| `mode`             | `auto \| local \| remote \| parallel`  | `auto`     | `auto` resolves to `parallel` if `parallel: true`, otherwise **`local`**. Set `mode: "remote"` explicitly for networking. |
| `reliability`      | `reliable \| unreliable`               | `reliable` | Remote only. |
| `batch`            | `boolean`                              | `false`    | Remote batching. |
| `batchWindow`      | `number` (sec)                         | `1/30`     | Flush window. |
| `batchMaxSize`     | `number`                               | `50`       | Max batch length. |
| `parallel`         | `boolean`                              | `false`    | Hint for `auto` mode. |
| `parallelPoolSize` | `number`                               | `4`        | Clamped 1–64. |
| `compression`      | `none \| rle \| Compressor`            | `none`     | Remote payload. |
| `schema`           | positional `SchemaLike[]` map          | —          | Per-arg validation on remote path. |

### `OmegaSignal<T>` methods

- `connect` / `once` → `SignalConnection`
- `fire`, `fireClient`, `fireAllClients`, `fireParallel`
- `use(middleware)`
- `asObservable()`
- `flush()` (remote batch)
- `destroy()`

### Built-in middlewares

| Middleware       | Default priority | Purpose |
| ---------------- | ---------------- | ------- |
| `rateLimit`      | 100              | Token bucket per sender |
| `auth`           | 95               | UserId / group / custom allow |
| `validate`       | 90               | Schema per positional arg |
| `antiExploit`    | 85               | Burst / pattern limits |
| `circuitBreaker` | 80               | Failure threshold / half-open |
| `throttle`       | 70               | Fixed-interval gate |
| `debounce`       | 70               | Leading/trailing debounce |
| `log`            | 10               | Structured log |
| `metrics`        | 5                | Latency / fires / aborts |

### Reactive operators

`map`, `filter`, `take`, `takeUntil`, `debounceOp`, `throttleOp`, `distinctUntilChanged`, `startWith`, `switchMap`, `merge`, `combineLatest`, `tap`.

### Validators (`schema.*`)

`schema.number(min?, max?)`, `schema.string(maxLen?)`, `schema.boolean()`, `schema.instanceOf("Class")`, `schema.player()`, `schema.vector3()` — `SchemaLike<T>` with `parse` / `safeParse`.

### Peer dependencies

`@flamework/core`, `@rbxts/fusion`, and `@rbxts/react` are **optional**: this package does not register Flamework services for you. Install them in **your** game when you wire Omeganet into Flamework, Fusion, or React.

---

## CLI

Once installed, the `omeganet` CLI is available via `npx`:

```bash
npx omeganet generate signal PlayerDamage
npx omeganet generate middleware AntiGrief
npx omeganet generate service Combat
npx omeganet analyze src/
```

The `analyze` command is a static linter that flags `any`, non-null assertions, `typeOf(x) === ...` patterns, unmatched fires, and unvalidated remotes.

---

## Architecture

```
@rbxts/omeganet
├── core/          Signal<T>, ThreadPool helpers
├── bus/           createEventBus
├── scope/         createScope (tracked disposables)
├── middleware/    MiddlewareChain + built-ins
├── remote/        RemoteSignal, RemoteFunctionX, Batcher (internal), Compressor, Validator, Reconciler
├── parallel/      ActorPool (1..64), SharedState, RaceDetector
├── reactive/      Observable, Subject, BehaviorSubject, operators, hooks
├── algo/          Analyzer, defaultRules, Suggestion types
├── devtools/      Collector, DevToolsStream, Studio plugin
├── testing/       MockSignal, simulate, snapshot helpers
├── common/        Result, branded IDs, assertNever
├── omega/         Facade.Omega namespace
└── types/         Extra public type re-exports
```

---

## Conventions (repo)

- **roblox-ts**: `rbxtsc`, no Node app preset for the game output; see `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, etc.).
- **Quality**: `npm run check` (typecheck, build, lint, knip).
- **Roblox**: `typeIs` / `classIs`, validate remotes on the server.

---

## Contributing

Issues, PRs and ideas welcome.

1. `npm install`
2. `npm run typecheck` — `tsc --noEmit` (lib + CLI)
3. `npm run build` — `rbxtsc`
4. `npm run build:cli` — CLI Node
5. `npm run lint` — ESLint (`projectService`)
6. `npm run knip`
7. Or run everything at once: `npm run check`
8. `npm test` — bench Studio (`tests/studio/`)

---

## License

MIT © 0xRynal, 2026
