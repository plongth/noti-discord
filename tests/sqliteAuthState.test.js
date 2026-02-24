import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import useSQLiteAuthState from "../src/auth/sqliteAuthState.js";
import storage from "../src/storage.js";

const withTempStorage = async (fn) => {
	const originalDir = storage._storageDir;
	const tempBase = await fs.mkdtemp(
		path.join(os.tmpdir(), "wa2dc-sqlite-auth-"),
	);
	const sandboxDir = path.join(tempBase, "storage");

	storage._storageDir = sandboxDir;
	await storage.close();
	try {
		await fn({ tempBase, sandboxDir });
	} finally {
		await storage.close();
		storage._storageDir = originalDir;
		await fs.rm(tempBase, { recursive: true, force: true });
	}
};

test("SQLite auth state stores and loads Baileys key namespaces", async () => {
	await withTempStorage(async () => {
		const { state: authState } = await useSQLiteAuthState();

		await authState.keys.set({
			tctoken: { test: Buffer.from("rc8") },
			"lid-mapping": { pn: "161040050426060:29@lid" },
			"device-index": { primary: Buffer.from("device-index") },
			"device-list": { primary: Buffer.from("device-list") },
			"app-state-sync-key": {
				sync1: { keyData: Buffer.from("sync-data") },
			},
		});

		const stored = await authState.keys.get("tctoken", ["test"]);
		const lidMapping = await authState.keys.get("lid-mapping", ["pn"]);
		const deviceIndex = await authState.keys.get("device-index", ["primary"]);
		const deviceList = await authState.keys.get("device-list", ["primary"]);
		const appStateKey = await authState.keys.get("app-state-sync-key", [
			"sync1",
		]);

		assert.equal(stored.test.toString("base64"), "cmM4");
		assert.equal(lidMapping.pn, "161040050426060:29@lid");
		assert.equal(deviceIndex.primary.toString("utf8"), "device-index");
		assert.equal(deviceList.primary.toString("utf8"), "device-list");
		assert.ok(appStateKey.sync1);
		assert.equal(
			Buffer.from(appStateKey.sync1.keyData).toString("utf8"),
			"sync-data",
		);

		await authState.keys.set({ tctoken: { test: null } });
		const removed = await authState.keys.get("tctoken", ["test"]);
		assert.equal(removed.test, null);
	});
});

test("SQLite auth state persists creds via saveCreds", async () => {
	await withTempStorage(async () => {
		const first = await useSQLiteAuthState();
		first.state.creds.registered = true;
		first.state.creds.accountSyncCounter = 9;
		await first.saveCreds();

		const second = await useSQLiteAuthState();
		assert.equal(second.state.creds.registered, true);
		assert.equal(second.state.creds.accountSyncCounter, 9);
	});
});
