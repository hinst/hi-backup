import 'source-map-support/register';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compareSync } from 'dir-compare';
import { EncryptionTransformer } from './encryptionTransformer';
import { FolderSyncStats } from './folderStats';
import { FolderSync } from './folderSync';
import { FolderUnpack } from './folderUnpack';

test(FolderSync.name, async function () {
	const expectedStats = new FolderSyncStats();
	{
		// Initial sync
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		const folderSync = new FolderSync('./test', './test.1');
		folderSync.fileTransformer = new EncryptionTransformer('password1');
		await folderSync.run();
		expectedStats.sourceDirectories = 1;
		expectedStats.newDirectories = 2;
		expectedStats.deletedDirectories = 0;
		expectedStats.sourceFiles = 4;
		expectedStats.newFiles = 4;
		expectedStats.updatedFiles = 0;
		expectedStats.deletedFiles = 0;
		assert.deepEqual(folderSync.stats, expectedStats);
	}
	{
		// Repeated sync: nothing should change, expecting 0 updated files
		const folderSync = new FolderSync('./test', './test.1');
		folderSync.fileTransformer = new EncryptionTransformer('password1');
		await folderSync.run();
		expectedStats.newDirectories = 0;
		expectedStats.newFiles = 0;
		assert.deepEqual(folderSync.stats, expectedStats);
	}
	{
		// Unpack and compare
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
		const folderUnpack = new FolderUnpack('./test.1', './test.0');
		folderUnpack.fileTransformer = new EncryptionTransformer('password1');
		await folderUnpack.run();
		const comparison = compareSync('./test', './test.0', { compareContent: true });
		assert.equal(comparison.same, true);
		assert.equal(comparison.total, 5);
	}
	// Cleanup
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});

test(FolderSync.name + '.addAndDelete', async function () {
	{
		// Initial sync
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		const folderSync = new FolderSync('./test', './test.1');
		folderSync.fileTransformer = new EncryptionTransformer('password');
		await folderSync.run();
	}
	{
		// Adding file new.txt
		fs.writeFileSync('./test/new.txt', 'test');
		const folderSync = new FolderSync('./test', './test.1');
		folderSync.fileTransformer = new EncryptionTransformer('password');
		await folderSync.run();
		assert.equal(folderSync.stats.newFiles, 1);
		assert.equal(folderSync.stats.deletedFiles, 0);

		// Unpack and compare
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
		const folderUnpack = new FolderUnpack('./test.1', './test.0');
		folderUnpack.fileTransformer = new EncryptionTransformer('password');
		await folderUnpack.run();
		const comparison = compareSync('./test', './test.0', { compareContent: true });
		assert.equal(comparison.same, true);
		assert.equal(comparison.total, 6);
	}
	{
		// Removing file new.txt
		fs.unlinkSync('./test/new.txt');
		console.log('deleted ./test/new.txt');
		const folderSync = new FolderSync('./test', './test.1');
		folderSync.fileTransformer = new EncryptionTransformer('secret-password');
		await folderSync.run();
		assert.equal(folderSync.stats.newFiles, 0);
		assert.equal(folderSync.stats.deletedFiles, 1);

		// Unpack and compare
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
		const folderUnpack = new FolderUnpack('./test.1', './test.0');
		folderUnpack.fileTransformer = new EncryptionTransformer('secret-password');
		await folderUnpack.run();
		const comparison = compareSync('./test', './test.0', { compareContent: true });
		assert.equal(comparison.same, true);
		assert.equal(comparison.total, 5);
	}
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});

test(FolderSync.name + '.wrongPassword', async function () {
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

	const folderSync = new FolderSync('./test', './test.1');
	folderSync.fileTransformer = new EncryptionTransformer('password');
	await folderSync.run();
	let error: AnyError;
	try {
		const folderUnpack = new FolderUnpack('./test.1', './test.0');
		folderUnpack.fileTransformer = new EncryptionTransformer('password1');
		await folderUnpack.run();
	} catch (e) {
		error = e;
	}
	assert.equal(error.reason, 'bad decrypt');

	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});

test(FolderSync.name + '.editFile', async function () {
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	const originalText = fs.readFileSync('./test/folder/text.txt', 'utf-8');
	{
		// Initial sync
		const folderSync = new FolderSync('./test', './test.1');
		folderSync.fileTransformer = new EncryptionTransformer('password');
		await folderSync.run();
	}
	{
		// Edit file
		fs.writeFileSync('./test/folder/text.txt', 'changed text');
		const folderSync = new FolderSync('./test', './test.1');
		folderSync.fileTransformer = new EncryptionTransformer('password');
		await folderSync.run();
		assert.equal(folderSync.stats.updatedFiles, 1);
		assert.equal(folderSync.stats.newFiles, 0);
	}
	{
		// Unpack
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
		const folderUnpack = new FolderUnpack('./test.1', './test.0');
		folderUnpack.fileTransformer = new EncryptionTransformer('password');
		await folderUnpack.run();
		assert.equal(true, compareSync('./test', './test.0', { compareContent: true }).same);
	}
	// Restore initial file state
	fs.writeFileSync('./test/folder/text.txt', originalText);
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});
