import {
	Omeganet,
	Observable,
	BehaviorSubject,
	debounceOp,
	distinctUntilChanged,
	map,
	createSignalValue,
} from "@rbxts/omeganet";

const inputSignal = Omeganet.Omega.create<(text: string) => void>({
	name: "userInput",
	mode: "local",
});

const search$ = inputSignal.asObservable().pipe(
	map<[string], string>((args) => args[0]),
	debounceOp<string>(0.3),
	distinctUntilChanged<string>(),
) as Observable<string>;

const searchBinding = createSignalValue<string>("", search$);

search$.subscribe((text) => {
	print(`[reactive] search query changed: "${text}"`);
});

const score = new BehaviorSubject(0);
score.subscribe((v) => print(`[reactive] score=${v}`));
task.spawn(() => {
	for (let i = 1; i <= 5; i++) {
		task.wait(0.5);
		score.next(i * 10);
	}
});

print(`[reactive] current search binding: ${searchBinding.get()}`);
