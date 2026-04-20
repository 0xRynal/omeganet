/// <reference path="../../node_modules/@rbxts/types/include/generated/PluginSecurity.d.ts" />
import { RunService } from "@rbxts/services";
import { Collector, DevToolsStream } from "./Collector";

export type StudioPanelHandle = {
	readonly dockWidget: DockWidgetPluginGui;
	readonly refresh: () => void;
	readonly destroy: () => void;
};

export function mountStudioPanel(plugin: Plugin): StudioPanelHandle {
	assert(RunService.IsStudio(), "[SignalX] mountStudioPanel requires Studio");

	const info = new DockWidgetPluginGuiInfo(
		Enum.InitialDockState.Float,
		true,
		false,
		380,
		520,
		280,
		400,
	);
	const widget = plugin.CreateDockWidgetPluginGui("OmeganetPanel", info);
	(widget as unknown as { Title: string }).Title = "Omeganet";

	const frame = new Instance("ScrollingFrame");
	frame.Size = new UDim2(1, 0, 1, 0);
	frame.BackgroundColor3 = Color3.fromRGB(30, 30, 35);
	frame.BorderSizePixel = 0;
	frame.CanvasSize = new UDim2(0, 0, 0, 0);
	frame.AutomaticCanvasSize = Enum.AutomaticSize.Y;
	frame.Parent = widget;

	const layout = new Instance("UIListLayout");
	layout.Padding = new UDim(0, 4);
	layout.Parent = frame;

	const rowByName = new Map<string, TextLabel>();

	const refresh = () => {
		for (const stats of Collector.getAllStats()) {
			let row = rowByName.get(stats.name);
			if (row === undefined) {
				row = new Instance("TextLabel");
				row.Size = new UDim2(1, -8, 0, 36);
				row.BackgroundColor3 = Color3.fromRGB(40, 40, 50);
				row.BorderSizePixel = 0;
				row.Font = Enum.Font.Code;
				row.TextColor3 = Color3.fromRGB(220, 220, 230);
				row.TextSize = 13;
				row.TextXAlignment = Enum.TextXAlignment.Left;
				row.Parent = frame;
				rowByName.set(stats.name, row);
			}
			row.Text = string.format(
				"  %s [%s]  fires=%d  abort=%d  %.1f/s",
				stats.name,
				stats.mode,
				stats.fires,
				stats.aborts,
				stats.firesPerSecond,
			);
		}
	};

	const connection = DevToolsStream.connect(() => refresh());

	const destroy = () => {
		connection.disconnect();
		widget.Destroy();
	};

	return {
		dockWidget: widget,
		refresh,
		destroy,
	};
}
