export type SuggestionSeverity = "info" | "warn" | "critical";
export type Suggestion = {
	readonly severity: SuggestionSeverity;
	readonly signalName: string;
	readonly rule: string;
	readonly message: string;
	readonly fix?: string;
	readonly timestamp: number;
};