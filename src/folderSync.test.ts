import 'source-map-support/register';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compareSync } from 'dir-compare';
import { EncryptionTransformer } from './encryptionTransformer';
import { FolderEncryption } from './folderEncryption';
import { FolderSyncStats } from './folderStats';
import { FolderSync } from './folderSync';
import { FolderUnpack } from './folderUnpack';

test(FolderSync.name, async function () {
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

test(FolderEncryption.prototype.sync.name + '.addAndDelete', async function () {
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });

	{
		// Initial
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
		folderSync.fileTransformer = new EncryptionTransformer('password');
		await folderSync.run();
		assert.equal(folderSync.stats.newFiles, 0);
		assert.equal(folderSync.stats.deletedFiles, 1);

		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
		const folderUnpack = new FolderUnpack('./test.1', './test.0');
		folderUnpack.fileTransformer = new EncryptionTransformer('password');
		await folderUnpack.run();
		const comparison = compareSync('./test', './test.0', { compareContent: true });
		assert.equal(comparison.same, true);
		assert.equal(comparison.total, 5);
	}

	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});

test(FolderEncryption.prototype.sync.name + '.wrongPassword', async function () {
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

test(FolderEncryption.prototype.sync.name + '.editFile', async function () {
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

	const folderSync = new FolderSync('./test', './test.1');
	folderSync.fileTransformer = new EncryptionTransformer('password');
	await folderSync.run();
	const originalText = fs.readFileSync('./test/folder/text.txt', 'utf-8');
	fs.writeFileSync('./test/folder/text.txt', 'changed text');
	await folderSync.run();
	assert.equal(folderSync.stats.updatedFiles, 1);
	assert.equal(folderSync.stats.newFiles, 0);

	const folderUnpack = new FolderUnpack('./test.1', './test.0');
	folderUnpack.fileTransformer = new EncryptionTransformer('password');
	await folderUnpack.run();
	assert.equal(true, compareSync('./test', './test.0', { compareContent: true }).same);

	fs.writeFileSync('./test/folder/text.txt', originalText);

	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});
