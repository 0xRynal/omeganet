
type Job = (...args: Array<unknown>) => unknown;
const freeThreads: Array<thread> = [];
function runJob(job: Job, thread: thread, args: Array<unknown>): void {
	job(...args);
	freeThreads.push(thread);
}
function threadLoop(): void {
	while (true) {
		const [job, thread, args] = coroutine.yield() as LuaTuple<[Job, thread, Array<unknown>]>;
		runJob(job, thread, args);
	}
}
export function spawnWithPool(job: Job, ...args: Array<unknown>): void {
	const reused = freeThreads.pop();
	if (reused !== undefined) {
		coroutine.resume(reused, job, reused, args);
		return;
	}
	const fresh = coroutine.create(threadLoop);
	coroutine.resume(fresh);
	coroutine.resume(fresh, job, fresh, args);
}
export function poolSize(): number {
	return freeThreads.size();
}
export function clearPool(): void {
	freeThreads.clear();
}