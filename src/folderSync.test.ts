import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { compareSync } from 'dir-compare';
import { EncryptionTransformer } from './encryptionTransformer';
import { FolderEncryption } from './folderEncryption';
import { FolderSyncStats } from './folderStats';
import { FolderSync } from './folderSync';
import { FolderUnpack } from './folderUnpack';

describe(FolderSync.prototype.run.name, { concurrency: 1 }, function () {
	it(FolderSync.prototype.run.name, async function () {
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

		const folderSync = new FolderSync('./test', './test.1');
		folderSync.fileTransformer = new EncryptionTransformer('password1');
		await folderSync.run();
		const expectedStats = new FolderSyncStats();
		expectedStats.sourceDirectories = 1;
		expectedStats.newDirectories = 2;
		expectedStats.deletedDirectories = 0;
		expectedStats.sourceFiles = 4;
		expectedStats.newFiles = 4;
		expectedStats.updatedFiles = 0;
		expectedStats.deletedFiles = 0;
		assert.deepEqual(folderSync.stats, expectedStats);
		expectedStats.newDirectories = 0;
		expectedStats.newFiles = 0;
		await folderSync.run();
		assert.deepEqual(folderSync.stats, expectedStats);

		const folderUnpack = new FolderUnpack('./test.1', './test.0');
		folderUnpack.fileTransformer = new EncryptionTransformer('password1');
		await folderUnpack.run();
		console.log('exists', fs.existsSync('./test.0'));

		const comparison = compareSync('./test', './test.0', { compareContent: true });
		assert.equal(comparison.same, true);
		assert.equal(comparison.total, 5);

		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
	});

	it(FolderEncryption.prototype.sync.name + '.addAndDelete', async function () {
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

		const folderEncryption = new FolderEncryption('password', './test', './test.1');
		await folderEncryption.sync();

		fs.writeFileSync('./test/new.txt', 'test');
		await folderEncryption.sync();
		assert.equal(folderEncryption.stats.newFiles, 1);
		assert.equal(folderEncryption.stats.deletedFiles, 0);
		new FolderEncryption('password', './test.1', './test.0').unpack();
		let comparison = compareSync('./test', './test.0', { compareContent: true });
		assert.equal(comparison.same, true);
		assert.equal(comparison.total, 6);

		fs.unlinkSync('./test/new.txt');
		await folderEncryption.sync();
		assert.equal(folderEncryption.stats.newFiles, 0);
		assert.equal(folderEncryption.stats.deletedFiles, 1);
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
		new FolderEncryption('password', './test.1', './test.0').unpack();
		comparison = compareSync('./test', './test.0', { compareContent: true });
		assert.equal(comparison.same, true);
		assert.equal(comparison.total, 5);

		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
	});

	it(FolderEncryption.prototype.sync.name + '.wrongPassword', async function () {
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

		await new FolderEncryption('password', './test', './test.1').sync();
		let error: AnyError;
		try {
			new FolderEncryption('password1', './test.1', './test.0').unpack();
		} catch (e) {
			error = e;
		}
		assert.equal(error.reason, 'bad decrypt');

		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
	});

	it(FolderEncryption.prototype.sync.name + '.editFile', async function () {
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

		await new FolderEncryption('password', './test', './test.1').sync();
		const originalText = fs.readFileSync('./test/folder/text.txt', 'utf-8');
		fs.writeFileSync('./test/folder/text.txt', 'changed text');
		const folderEncryption = new FolderEncryption('password', './test', './test.1');
		await folderEncryption.sync();
		assert.equal(folderEncryption.stats.updatedFiles, 1);
		assert.equal(folderEncryption.stats.newFiles, 0);

		new FolderEncryption('password', './test.1', './test.0').unpack();
		assert.equal(true, compareSync('./test', './test.0', { compareContent: true }).same);

		fs.writeFileSync('./test/folder/text.txt', originalText);

		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
	});
});
