import assert from "node:assert/strict";
import test from "node:test";

import storage from "../src/storage.js";
import utils from "../src/utils.js";

await storage.ensureInitialized();

test("Discord attachment/embed image URLs dedupe via proxy normalization", () => {
	const cdnUrl =
		"https://cdn.discordapp.com/attachments/123/456/image.png?ex=abc&is=def&hm=ghi";
	const proxyUrl =
		"https://images-ext-1.discordapp.net/external/token/https/cdn.discordapp.com/attachments/123/456/image.png?format=webp&width=400&height=300";

	assert.equal(
		utils.discord.normalizeAttachmentUrl(cdnUrl),
		utils.discord.normalizeAttachmentUrl(proxyUrl),
	);

	const deduped = utils.discord.dedupeCollectedAttachments([
		{ url: cdnUrl, name: "image.png", contentType: "image/png" },
		{ url: proxyUrl, name: "image.webp", contentType: "image/webp" },
	]);
	assert.equal(deduped.length, 1);
});
