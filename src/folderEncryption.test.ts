import test from 'node:test';
import fs from 'fs';
import assert from 'node:assert/strict';
import { compareSync } from 'dir-compare';
import { FolderEncryption, FolderEncryptionStats } from './folderEncryption';

test(FolderEncryption.prototype.sync.name, function () {
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

	let folderEncryption = new FolderEncryption('password', './test', './test.1');
	folderEncryption.sync();
	const expectedStats = Object.assign(new FolderEncryptionStats(), {
		sourceFolders: 1,
		newFolders: 2,
		deletedFolders: 0,
		sourceFiles: 4,
		newFiles: 4,
		updatedFiles: 0,
		deletedFiles: 0
	});
	assert.deepEqual(folderEncryption.stats, expectedStats);
	expectedStats.newFolders = 0;
	expectedStats.newFiles = 0;
	folderEncryption.sync();
	assert.deepEqual(folderEncryption.stats, expectedStats);

	folderEncryption = new FolderEncryption('password', './test.1', './test.0');
	folderEncryption.unpack();

	const comparison = compareSync('./test', './test.0', { compareContent: true });
	assert.equal(comparison.same, true);
	assert.equal(comparison.total, 5);

	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});

test(FolderEncryption.prototype.sync.name + '.addAndDelete', function () {
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

	let folderEncryption = new FolderEncryption('password', './test', './test.1');
	folderEncryption.sync();

	fs.writeFileSync('./test/new.txt', 'test');
	folderEncryption.sync();
	assert.equal(folderEncryption.stats.newFiles, 1);
	assert.equal(folderEncryption.stats.deletedFiles, 0);
	new FolderEncryption('password', './test.1', './test.0').unpack();
	let comparison = compareSync('./test', './test.0', { compareContent: true });
	assert.equal(comparison.same, true);
	assert.equal(comparison.total, 6);

	fs.unlinkSync('./test/new.txt');
	folderEncryption.sync();
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

test(FolderEncryption.prototype.sync.name + '.wrongPassword', function () {
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

	new FolderEncryption('password', './test', './test.1').sync();
	let error: any;
	try {
		new FolderEncryption('password1', './test.1', './test.0').unpack();
	} catch (e) {
		error = e;
	}
	assert.equal(error.reason, 'bad decrypt');

	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});

test(FolderEncryption.prototype.sync.name + '.editFile', function () {
	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });

	new FolderEncryption('password', './test', './test.1').sync();
	const originalText = fs.readFileSync('./test/folder/text.txt', 'utf-8');
	fs.writeFileSync('./test/folder/text.txt', 'changed text');
	const folderEncryption = new FolderEncryption('password', './test', './test.1');
	folderEncryption.sync();
	assert.equal(folderEncryption.stats.updatedFiles, 1);
	assert.equal(folderEncryption.stats.newFiles, 0);

	new FolderEncryption('password', './test.1', './test.0').unpack();
	assert.equal(true, compareSync('./test', './test.0', { compareContent: true }).same);

	fs.writeFileSync('./test/folder/text.txt', originalText);

	if (fs.existsSync('./test.1')) fs.rmSync('./test.1', { recursive: true });
	if (fs.existsSync('./test.0')) fs.rmSync('./test.0', { recursive: true });
});
