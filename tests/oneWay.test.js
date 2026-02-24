import assert from "node:assert/strict";
import test from "node:test";

import {
	hasOneWayDirection,
	ONE_WAY_DIRECTIONS,
	ONE_WAY_MODES,
	oneWayAllowsDiscordToWhatsApp,
	oneWayAllowsWhatsAppToDiscord,
} from "../src/oneWay.js";

test("oneWay mode presets match expected direction masks", () => {
	assert.equal(ONE_WAY_DIRECTIONS.WHATSAPP_TO_DISCORD, 0b01);
	assert.equal(ONE_WAY_DIRECTIONS.DISCORD_TO_WHATSAPP, 0b10);
	assert.equal(ONE_WAY_MODES.TO_DISCORD_ONLY, 0b01);
	assert.equal(ONE_WAY_MODES.TO_WHATSAPP_ONLY, 0b10);
	assert.equal(ONE_WAY_MODES.TWO_WAY, 0b11);
});

test("oneWay direction helpers gate flows correctly", () => {
	assert.equal(
		oneWayAllowsWhatsAppToDiscord(ONE_WAY_MODES.TO_DISCORD_ONLY),
		true,
	);
	assert.equal(
		oneWayAllowsDiscordToWhatsApp(ONE_WAY_MODES.TO_DISCORD_ONLY),
		false,
	);

	assert.equal(
		oneWayAllowsDiscordToWhatsApp(ONE_WAY_MODES.TO_WHATSAPP_ONLY),
		true,
	);
	assert.equal(
		oneWayAllowsWhatsAppToDiscord(ONE_WAY_MODES.TO_WHATSAPP_ONLY),
		false,
	);

	assert.equal(oneWayAllowsDiscordToWhatsApp(ONE_WAY_MODES.TWO_WAY), true);
	assert.equal(oneWayAllowsWhatsAppToDiscord(ONE_WAY_MODES.TWO_WAY), true);
});

test("hasOneWayDirection treats invalid values as disabled", () => {
	assert.equal(
		hasOneWayDirection(undefined, ONE_WAY_DIRECTIONS.DISCORD_TO_WHATSAPP),
		false,
	);
	assert.equal(
		hasOneWayDirection("invalid", ONE_WAY_DIRECTIONS.WHATSAPP_TO_DISCORD),
		false,
	);
});
