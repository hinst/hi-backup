import 'source-map-support/register';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compareSync } from 'dir-compare';
import { EncryptionTransformer } from 'src/files/transformers/encryptionTransformer';
import { FileTransformer } from 'src/files/transformers/fileTransformer';
import { GzipFileTransformer } from 'src/files/transformers/gzipFileTransformer';
import { ReverseFileTransformer } from 'src/files/transformers/reverseFileTransformer';
import { FolderSyncStats } from 'src/folderStats';
import { FolderSync } from 'src/folderSync';

class FolderSyncTest extends FolderSync {
	progressLogEnabled = false;
}

function registerFolderSyncTests(suiteName: string, makeTransformer: () => FileTransformer) {
	test(suiteName, async function () {
		const expectedStats = new FolderSyncStats();
		{
			// Initial sync
			if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
			const folderSync = new FolderSyncTest('./test', './test.1');
			folderSync.fileTransformer = makeTransformer();
			await folderSync.run();
			expectedStats.sourceDirectories = 1;
			expectedStats.newDirectories = 2;
			expectedStats.deletedDirectories = 0;
			expectedStats.sourceFiles = 4;
			expectedStats.newFiles = 4;
			expectedStats.updatedFiles = 0;
			expectedStats.deletedFiles = 0;
			assert.deepEqual(folderSync.stats, expectedStats);
			assert.equal(folderSync.deviationCount, 0);
		}
		{
			// Repeated sync: nothing should change, expecting 0 updated files
			const folderSync = new FolderSyncTest('./test', './test.1');
			folderSync.fileTransformer = makeTransformer();
			await folderSync.run();
			expectedStats.newDirectories = 0;
			expectedStats.newFiles = 0;
			assert.deepEqual(folderSync.stats, expectedStats);
			assert.equal(folderSync.deviationCount, 0);
		}
		{
			// Unpack and compare
			if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
			const folderUnpack = new FolderSyncTest('./test.1', './test.0');
			folderUnpack.fileTransformer = new ReverseFileTransformer(makeTransformer());
			await folderUnpack.run();
			const comparison = compareSync('./test', './test.0', { compareContent: true });
			assert.equal(comparison.same, true);
			assert.equal(comparison.total, 5);
			assert.equal(folderUnpack.deviationCount, 0);
		}
		// Cleanup
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
	});

	test(suiteName + '.addAndDelete', async function () {
		{
			// Initial sync
			if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
			const folderSync = new FolderSyncTest('./test', './test.1');
			folderSync.fileTransformer = makeTransformer();
			await folderSync.run();
		}
		{
			// Adding file new.txt
			fs.writeFileSync('./test/new.txt', 'test');
			const folderSync = new FolderSyncTest('./test', './test.1');
			folderSync.fileTransformer = makeTransformer();
			await folderSync.run();
			assert.equal(folderSync.stats.newFiles, 1);
			assert.equal(folderSync.stats.deletedFiles, 0);

			// Unpack and compare
			if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
			const folderUnpack = new FolderSyncTest('./test.1', './test.0');
			folderUnpack.fileTransformer = new ReverseFileTransformer(makeTransformer());
			await folderUnpack.run();
			const comparison = compareSync('./test', './test.0', { compareContent: true });
			assert.equal(comparison.same, true);
			assert.equal(comparison.total, 6);
		}
		{
			// Removing file new.txt
			fs.unlinkSync('./test/new.txt');
			console.log('deleted ./test/new.txt');
			const folderSync = new FolderSyncTest('./test', './test.1');
			folderSync.fileTransformer = makeTransformer();
			await folderSync.run();
			assert.equal(folderSync.stats.newFiles, 0);
			assert.equal(folderSync.stats.deletedFiles, 1);

			// Unpack and compare
			if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
			const folderUnpack = new FolderSyncTest('./test.1', './test.0');
			folderUnpack.fileTransformer = new ReverseFileTransformer(makeTransformer());
			await folderUnpack.run();
			const comparison = compareSync('./test', './test.0', { compareContent: true });
			assert.equal(comparison.same, true);
			assert.equal(comparison.total, 5);
		}
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
	});

	test(suiteName + '.editFile', async function () {
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		const originalText = fs.readFileSync('./test/folder/text.txt', 'utf-8');
		{
			// Initial sync
			const folderSync = new FolderSyncTest('./test', './test.1');
			folderSync.fileTransformer = makeTransformer();
			await folderSync.run();
		}
		{
			// Edit file
			fs.writeFileSync('./test/folder/text.txt', 'changed text');
			const folderSync = new FolderSyncTest('./test', './test.1');
			folderSync.fileTransformer = makeTransformer();
			await folderSync.run();
			assert.equal(folderSync.stats.updatedFiles, 1);
			assert.equal(folderSync.stats.newFiles, 0);
		}
		{
			// Unpack
			if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
			const folderUnpack = new FolderSyncTest('./test.1', './test.0');
			folderUnpack.fileTransformer = new ReverseFileTransformer(makeTransformer());
			await folderUnpack.run();
			assert.equal(true, compareSync('./test', './test.0', { compareContent: true }).same);
		}
		// Restore initial file state
		fs.writeFileSync('./test/folder/text.txt', originalText);

		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
	});
}

registerFolderSyncTests(FolderSync.name + '.Plain', () => new FileTransformer());
registerFolderSyncTests(FolderSync.name + '.Gzip', () => new GzipFileTransformer());
registerFolderSyncTests(
	FolderSync.name + '.Encryption',
	() => new EncryptionTransformer('password11'),
);

test(FolderSyncTest.name + '.wrongPassword', async function () {
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	const folderSync = new FolderSyncTest('./test', './test.1');
	folderSync.fileTransformer = new EncryptionTransformer('password');
	await folderSync.run();

	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
	const folderUnpack = new FolderSyncTest('./test.1', './test.0');
	folderUnpack.fileTransformer = new ReverseFileTransformer(new EncryptionTransformer('password1'));
	let error: AnyError;
	try {
		await folderUnpack.run();
	} catch (e) {
		error = e;
	}
	assert.equal(error.reason, 'bad decrypt');

	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});

test(FolderSync.name + '.hashChangeUnpack', async function () {
	{
		// Initial sync
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		const folderSync = new FolderSyncTest('./test', './test.1');
		await folderSync.run();
	}

	// Edit file
	fs.writeFileSync('./test.1/text.txt', 'changed text');

	// Repeated sync
	const folderSync = new FolderSyncTest('./test', './test.1');
	await folderSync.run();

	assert.equal(folderSync.deviationCount, 1);

	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});

test(FolderSync.name + '.hashChangeUnpack', async function () {
	{
		// Initial sync
		if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
		const folderSync = new FolderSyncTest('./test', './test.1');
		await folderSync.run();
	}

	// Edit file
	fs.writeFileSync('./test.1/text.txt', 'changed text');

	// Unpack
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
	const folderUnpack = new FolderSyncTest('./test.1', './test.0');
	folderUnpack.fileTransformer = new ReverseFileTransformer(folderUnpack.fileTransformer);
	await folderUnpack.run();

	assert.equal(folderUnpack.deviationCount, 1);

	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});
