import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import state from "../src/state.js";
import utils from "../src/utils.js";

test("Discord webhook transport classifier treats fetch timeout failures as retryable", () => {
	const timeoutError = new AggregateError([], "connect timed out");
	timeoutError.code = "ETIMEDOUT";

	const err = new TypeError("fetch failed");
	err.cause = timeoutError;
	err.stack =
		"TypeError: fetch failed\n    at node:internal/deps/undici/undici:16416:13";

	assert.equal(utils.discord.isRetryableWebhookTransportError(err), true);
});

test("WhatsApp-backed Discord uploads honor the configured burst size", () => {
	const originalBurstSize = state.settings.WhatsAppDiscordMediaBurstSize;
	try {
		state.settings.WhatsAppDiscordMediaBurstSize = 3;
		const files = Array.from({ length: 7 }, (_, idx) => ({
			name: `image-${idx + 1}.jpg`,
			attachment: Readable.from([Buffer.from("image")]),
			downloadCtx: { id: `wa-${idx + 1}` },
		}));

		const chunks = utils.discord.chunkWebhookFilesForSend(files);

		assert.deepEqual(
			chunks.map((chunk) => chunk.length),
			[3, 3, 1],
		);
	} finally {
		state.settings.WhatsAppDiscordMediaBurstSize = originalBurstSize;
	}
});

test("WhatsApp-backed Discord uploads default to Discord's full attachment batch size", () => {
	const originalBurstSize = state.settings.WhatsAppDiscordMediaBurstSize;
	try {
		state.settings.WhatsAppDiscordMediaBurstSize = 10;
		const files = Array.from({ length: 11 }, (_, idx) => ({
			name: `image-${idx + 1}.jpg`,
			attachment: Readable.from([Buffer.from("image")]),
			downloadCtx: { id: `wa-${idx + 1}` },
		}));

		const chunks = utils.discord.chunkWebhookFilesForSend(files);

		assert.deepEqual(
			chunks.map((chunk) => chunk.length),
			[10, 1],
		);
	} finally {
		state.settings.WhatsAppDiscordMediaBurstSize = originalBurstSize;
	}
});

test("Buffered Discord uploads still use the full Discord attachment batch size", () => {
	const files = Array.from({ length: 11 }, (_, idx) => ({
		name: `image-${idx + 1}.jpg`,
		attachment: Buffer.from("image"),
	}));

	const chunks = utils.discord.chunkWebhookFilesForSend(files);

	assert.deepEqual(
		chunks.map((chunk) => chunk.length),
		[10, 1],
	);
});
