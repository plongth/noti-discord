import childProcess from "node:child_process";

const WHATSAPP_GIF_TRANSCODE_TIMEOUT_MS = 20 * 1000;

const normalizeMimeType = (value = "") => {
	if (typeof value !== "string") return "";
	return value.split(";")[0].trim().toLowerCase();
};

const replaceFileExtension = (fileName = "", extension = "gif") => {
	const trimmed = typeof fileName === "string" ? fileName.trim() : "";
	if (!trimmed) return `videoMessage.${extension}`;
	if (!trimmed.includes(".")) {
		return `${trimmed}.${extension}`;
	}
	return trimmed.replace(/\.[^.]+$/u, `.${extension}`);
};

const transcodeVideoBufferToGif = async (inputBuffer) => {
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
				"-an",
				"-vf",
				"fps=12,split[s0][s1];[s0]palettegen=reserve_transparent=0[p];[s1][p]paletteuse",
				"-loop",
				"0",
				"-f",
				"gif",
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
		}, WHATSAPP_GIF_TRANSCODE_TIMEOUT_MS);

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

export const createWhatsAppGifToDiscordFileNormalizer = ({
	getLogger = null,
	transcodeBufferToGif = transcodeVideoBufferToGif,
} = {}) => {
	let ffmpegMissingLogged = false;
	const loggerForCall = () =>
		typeof getLogger === "function" ? getLogger() : getLogger;

	return async ({
		attachmentBuffer,
		fileName,
		mimetype,
		jid,
		messageId,
	} = {}) => {
		const normalizedMime = normalizeMimeType(mimetype);
		const normalizedName =
			typeof fileName === "string" && fileName.trim()
				? fileName.trim()
				: "videoMessage.mp4";
		if (!attachmentBuffer?.length || !normalizedMime.startsWith("video/")) {
			return {
				attachmentBuffer,
				fileName: normalizedName,
				contentType: normalizedMime || "application/octet-stream",
				converted: false,
			};
		}

		const logger = loggerForCall();
		try {
			const gifBuffer = await transcodeBufferToGif(attachmentBuffer);
			if (gifBuffer?.length) {
				return {
					attachmentBuffer: gifBuffer,
					fileName: replaceFileExtension(normalizedName, "gif"),
					contentType: "image/gif",
					converted: true,
				};
			}
		} catch (err) {
			if (err?.code === "ENOENT") {
				if (!ffmpegMissingLogged) {
					ffmpegMissingLogged = true;
					logger?.warn?.(
						"ffmpeg is not installed; WhatsApp GIFs will be mirrored to Discord as videos",
					);
				}
			} else {
				logger?.debug?.(
					{
						err,
						jid,
						messageId: messageId || null,
						fileName: normalizedName,
					},
					"Failed to transcode WhatsApp GIF to a Discord GIF attachment",
				);
			}
		}

		return {
			attachmentBuffer,
			fileName: normalizedName,
			contentType: normalizedMime || "video/mp4",
			converted: false,
		};
	};
};
