import childProcess from "node:child_process";

const DISCORD_AUDIO_FETCH_MAX_BYTES = 25 * 1024 * 1024;
const DISCORD_AUDIO_TRANSCODE_TIMEOUT_MS = 20 * 1000;
const DISCORD_VOICE_NAME_HINT_REGEX = /(voice|ptt|push-?to-?talk)/i;
const WHATSAPP_WAVEFORM_SAMPLES = 64;

const normalizeMimeType = (value = "") => {
	if (typeof value !== "string") return "";
	return value.split(";")[0].trim().toLowerCase();
};

const decodeDataUrlBuffer = (sourceUrl = "") => {
	const commaIndex = sourceUrl.indexOf(",");
	if (commaIndex < 0) {
		return null;
	}
	const meta = sourceUrl.slice(0, commaIndex);
	const payload = sourceUrl.slice(commaIndex + 1);
	if (!payload) {
		return null;
	}
	const isBase64 = /;base64$/i.test(meta);
	return isBase64
		? Buffer.from(payload, "base64")
		: Buffer.from(decodeURIComponent(payload), "utf8");
};

const loadAttachmentBufferForWhatsApp = async (attachment = {}) => {
	const sourceUrl =
		typeof attachment?.url === "string" ? attachment.url.trim() : "";
	if (!sourceUrl) return null;
	if (sourceUrl.startsWith("data:")) {
		const decoded = decodeDataUrlBuffer(sourceUrl);
		if (!decoded?.length) return null;
		if (decoded.length > DISCORD_AUDIO_FETCH_MAX_BYTES) {
			throw new Error(`buffer_length_exceeded:${decoded.length}`);
		}
		return decoded;
	}
	if (!/^https?:\/\//i.test(sourceUrl)) {
		return null;
	}
	const response = await fetch(sourceUrl);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	const contentLength = Number.parseInt(
		response.headers.get("content-length") || "",
		10,
	);
	if (
		Number.isFinite(contentLength) &&
		contentLength > DISCORD_AUDIO_FETCH_MAX_BYTES
	) {
		throw new Error(`content_length_exceeded:${contentLength}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length > DISCORD_AUDIO_FETCH_MAX_BYTES) {
		throw new Error(`buffer_length_exceeded:${buffer.length}`);
	}
	return buffer;
};

const isDiscordVoiceLikeAttachment = (attachment = {}, mimetype = "") => {
	const normalizedMime = normalizeMimeType(mimetype || attachment?.contentType);
	const name = typeof attachment?.name === "string" ? attachment.name : "";
	const durationCandidates = [
		attachment?.duration,
		attachment?.duration_secs,
		attachment?.durationSeconds,
	];
	const hasDuration = durationCandidates.some((entry) => {
		const value = Number(entry);
		return Number.isFinite(value) && value > 0;
	});
	return (
		Boolean(attachment?.waveform) ||
		hasDuration ||
		DISCORD_VOICE_NAME_HINT_REGEX.test(name) ||
		normalizedMime === "audio/ogg" ||
		normalizedMime === "audio/opus"
	);
};

const transcodeAudioBufferToOggOpus = async (inputBuffer) => {
	if (!inputBuffer?.length) return null;
	return await new Promise((resolve, reject) => {
		const ffmpeg = childProcess.spawn(
			"ffmpeg",
			[
				"-hide_banner",
				"-loglevel",
				"error",
				"-i",
				"pipe:0",
				"-vn",
				"-ac",
				"1",
				"-c:a",
				"libopus",
				"-ar",
				"48000",
				"-avoid_negative_ts",
				"make_zero",
				"-f",
				"ogg",
				"pipe:1",
			],
			{ stdio: ["pipe", "pipe", "pipe"] },
		);

		const stdoutChunks = [];
		const stderrChunks = [];
		let completed = false;
		const finish = (err, output = null) => {
			if (completed) return;
			completed = true;
			clearTimeout(timeout);
			if (err) {
				reject(err);
				return;
			}
			resolve(output);
		};
		const timeout = setTimeout(() => {
			ffmpeg.kill("SIGKILL");
			finish(new Error("ffmpeg_timeout"));
		}, DISCORD_AUDIO_TRANSCODE_TIMEOUT_MS);

		ffmpeg.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
		ffmpeg.stderr.on("data", (chunk) => stderrChunks.push(chunk));
		ffmpeg.on("error", (err) => finish(err));
		ffmpeg.on("close", (code) => {
			if (code !== 0) {
				const stderrText = Buffer.concat(stderrChunks).toString("utf8").trim();
				finish(
					new Error(`ffmpeg_exit_${code}${stderrText ? `:${stderrText}` : ""}`),
				);
				return;
			}
			const output = Buffer.concat(stdoutChunks);
			if (!output.length) {
				finish(new Error("ffmpeg_empty_output"));
				return;
			}
			finish(null, output);
		});

		ffmpeg.stdin.on("error", () => {});
		ffmpeg.stdin.end(inputBuffer);
	});
};

const generateWhatsAppStyleWaveform = async (
	inputBuffer,
	{ loadAudioDecoder, logger } = {},
) => {
	if (!inputBuffer?.length) return null;
	try {
		const decoderModule =
			typeof loadAudioDecoder === "function"
				? await loadAudioDecoder()
				: await import("audio-decode");
		const decoder =
			typeof decoderModule === "function"
				? decoderModule
				: decoderModule?.default;
		if (typeof decoder !== "function") {
			throw new Error("audio_decoder_unavailable");
		}
		const audioBuffer = await decoder(inputBuffer);
		const rawData =
			typeof audioBuffer?.getChannelData === "function"
				? audioBuffer.getChannelData(0)
				: null;
		if (!rawData?.length) {
			return null;
		}
		const blockSize = Math.max(
			1,
			Math.floor(rawData.length / WHATSAPP_WAVEFORM_SAMPLES),
		);
		const filteredData = [];
		for (let i = 0; i < WHATSAPP_WAVEFORM_SAMPLES; i++) {
			const blockStart = blockSize * i;
			if (blockStart >= rawData.length) {
				filteredData.push(0);
				continue;
			}
			const blockEnd = Math.min(rawData.length, blockStart + blockSize);
			let sum = 0;
			let count = 0;
			for (let j = blockStart; j < blockEnd; j++) {
				sum += Math.abs(rawData[j] || 0);
				count += 1;
			}
			filteredData.push(count > 0 ? sum / count : 0);
		}
		const peak = Math.max(...filteredData, 0);
		if (!(peak > 0)) {
			return new Uint8Array(WHATSAPP_WAVEFORM_SAMPLES);
		}
		return new Uint8Array(
			filteredData.map((entry) => {
				const normalized = Math.max(0, Math.min(1, entry / peak));
				return Math.floor(normalized * 100);
			}),
		);
	} catch (err) {
		logger?.debug?.({ err }, "Failed to generate WhatsApp voice-note waveform");
		return null;
	}
};

export const createAudioSendContentNormalizer = ({
	getLogger = null,
	normalizeBridgeMessageId = (value) => value,
	toBuffer = (value) => value,
	loadAudioDecoder = null,
} = {}) => {
	let ffmpegMissingLogged = false;
	const loggerForCall = () =>
		typeof getLogger === "function" ? getLogger() : getLogger;

	return async ({ attachment, content, jid, discordMessageId } = {}) => {
		if (!content || typeof content !== "object" || !content.audio) {
			return content;
		}
		const normalizedMime = normalizeMimeType(
			content?.mimetype || attachment?.contentType,
		);
		if (!normalizedMime.startsWith("audio/")) {
			return content;
		}

		const logger = loggerForCall();
		const normalizedContent = { ...content };
		const isVoiceLike = isDiscordVoiceLikeAttachment(
			attachment,
			normalizedMime,
		);
		if (isVoiceLike) {
			normalizedContent.ptt = true;
			const duration =
				Number(attachment?.duration) ||
				Number(attachment?.duration_secs) ||
				Number(attachment?.durationSeconds) ||
				0;
			if (Number.isFinite(duration) && duration > 0) {
				normalizedContent.seconds = Math.max(1, Math.round(duration));
			}
		}

		let sourceBuffer = null;
		try {
			sourceBuffer = await loadAttachmentBufferForWhatsApp(attachment);
		} catch (err) {
			logger?.debug?.(
				{
					err,
					jid,
					discordMessageId: normalizeBridgeMessageId(discordMessageId),
					attachmentName: attachment?.name || null,
					mimetype: normalizedMime,
				},
				"Failed to fetch Discord audio attachment before WhatsApp send",
			);
		}
		if (!sourceBuffer?.length) {
			return normalizedContent;
		}

		normalizedContent.audio = sourceBuffer;
		if (isVoiceLike) {
			const generatedWaveform = await generateWhatsAppStyleWaveform(sourceBuffer, {
				loadAudioDecoder,
				logger,
			});
			if (generatedWaveform?.length) {
				normalizedContent.waveform = Buffer.from(generatedWaveform);
			} else {
				const fallbackWaveform = toBuffer(attachment?.waveform);
				if (fallbackWaveform?.length) {
					normalizedContent.waveform = fallbackWaveform;
				}
			}
		}
		if (!isVoiceLike) {
			return normalizedContent;
		}

		try {
			const transcoded = await transcodeAudioBufferToOggOpus(sourceBuffer);
			if (transcoded?.length) {
				normalizedContent.audio = transcoded;
				normalizedContent.mimetype = "audio/ogg; codecs=opus";
			}
		} catch (err) {
			if (err?.code === "ENOENT") {
				if (!ffmpegMissingLogged) {
					ffmpegMissingLogged = true;
					logger?.warn?.(
						"ffmpeg is not installed; sending Discord voice messages without opus transcode",
					);
				}
			} else {
				logger?.debug?.(
					{
						err,
						jid,
						discordMessageId: normalizeBridgeMessageId(discordMessageId),
						attachmentName: attachment?.name || null,
					},
					"Failed to transcode Discord voice message to WhatsApp-compatible opus",
				);
			}
		}

		return normalizedContent;
	};
};
