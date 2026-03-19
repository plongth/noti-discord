import assert from "node:assert/strict";
import test from "node:test";

import { createAudioSendContentNormalizer } from "../src/internal/audioSendNormalization.js";

test("audio normalizer leaves non-audio content unchanged", async () => {
	const normalizeAudioSendContentForWhatsApp =
		createAudioSendContentNormalizer();
	const content = {
		image: { url: "https://cdn.discordapp.com/attachments/test.png" },
		mimetype: "image/png",
	};
	const normalized = await normalizeAudioSendContentForWhatsApp({
		attachment: { url: "https://cdn.discordapp.com/attachments/test.png" },
		content,
	});
	assert.equal(normalized, content);
});

test("audio normalizer marks voice-like attachments and hydrates audio buffer", async () => {
	const normalizeAudioSendContentForWhatsApp = createAudioSendContentNormalizer(
		{
			getLogger: () => ({ warn() {}, debug() {} }),
			loadAudioDecoder: async () => ({
				default: async () => ({
					getChannelData: () =>
						Float32Array.from(
							{ length: 64 },
							(_, index) => index / 63,
						),
				}),
			}),
			normalizeBridgeMessageId: (value) => value,
			toBuffer: (value) => {
				if (Buffer.isBuffer(value)) return value;
				if (value instanceof Uint8Array) return Buffer.from(value);
				return null;
			},
		},
	);
	const payload = Buffer.from("tiny-audio", "utf8");
	const normalized = await normalizeAudioSendContentForWhatsApp({
		attachment: {
			url: `data:audio/mpeg;base64,${payload.toString("base64")}`,
			name: "voice-note.m4a",
			contentType: "audio/mpeg",
			duration: 2.4,
			waveform: Buffer.from([1, 4, 2, 0, 5]),
		},
		content: {
			audio: { url: "https://cdn.discordapp.com/attachments/audio.m4a" },
			mimetype: "audio/mpeg",
		},
		jid: "123@s.whatsapp.net",
		discordMessageId: "dc-1",
	});
	assert.equal(normalized.ptt, true);
	assert.equal(normalized.seconds, 2);
	assert.ok(Buffer.isBuffer(normalized.waveform));
	assert.equal(normalized.waveform.length, 64);
	assert.equal(normalized.waveform[0], 0);
	assert.equal(normalized.waveform[1], 1);
	assert.equal(normalized.waveform[63], 100);
	assert.ok(Buffer.isBuffer(normalized.audio));
	assert.ok(normalized.audio.length > 0);
});

test("audio normalizer falls back to Discord waveform when local decode fails", async () => {
	const fallbackWaveform = Buffer.from([1, 4, 2, 0, 5]);
	const normalizeAudioSendContentForWhatsApp = createAudioSendContentNormalizer(
		{
			getLogger: () => ({ warn() {}, debug() {} }),
			loadAudioDecoder: async () => {
				throw new Error("decoder unavailable");
			},
			normalizeBridgeMessageId: (value) => value,
			toBuffer: (value) => {
				if (Buffer.isBuffer(value)) return value;
				if (value instanceof Uint8Array) return Buffer.from(value);
				return null;
			},
		},
	);
	const payload = Buffer.from("tiny-audio", "utf8");
	const normalized = await normalizeAudioSendContentForWhatsApp({
		attachment: {
			url: `data:audio/mpeg;base64,${payload.toString("base64")}`,
			name: "voice-note.m4a",
			contentType: "audio/mpeg",
			duration: 2.4,
			waveform: fallbackWaveform,
		},
		content: {
			audio: { url: "https://cdn.discordapp.com/attachments/audio.m4a" },
			mimetype: "audio/mpeg",
		},
		jid: "123@s.whatsapp.net",
		discordMessageId: "dc-2",
	});
	assert.equal(normalized.ptt, true);
	assert.deepEqual(normalized.waveform, fallbackWaveform);
});
