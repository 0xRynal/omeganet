export type Observer<T> = {
	readonly next: (value: T) => void;
	readonly error?: (err: unknown) => void;
	readonly complete?: () => void;
};
export type Teardown = () => void;
export type Subscriber<T> = (observer: Observer<T>) => Teardown | void;
export type Operator<TIn, TOut> = (source: ObservableLike<TIn>) => ObservableLike<TOut>;
export type Subscription = {
	readonly closed: boolean;
	readonly unsubscribe: () => void;
};
export type ObservableLike<T> = {
	readonly subscribe: (observer: Partial<Observer<T>> | ((value: T) => void)) => Subscription;
	readonly pipe: {
		<A>(op1: Operator<T, A>): ObservableLike<A>;
		<A, B>(op1: Operator<T, A>, op2: Operator<A, B>): ObservableLike<B>;
		<A, B, C>(op1: Operator<T, A>, op2: Operator<A, B>, op3: Operator<B, C>): ObservableLike<C>;
		<A, B, C, D>(
			op1: Operator<T, A>,
			op2: Operator<A, B>,
			op3: Operator<B, C>,
			op4: Operator<C, D>,
		): ObservableLike<D>;
		(...operators: Array<Operator<unknown, unknown>>): ObservableLike<unknown>;
	};
};