import test from 'node:test';
import fs from 'fs';
import assert from 'node:assert';
import { FolderEncryption, FolderEncryptionStats } from './folderEncryption';

test(FolderEncryption.prototype.sync.name, function () {
	if (fs.existsSync('./test.1')) fs.rmdirSync('./test.1', { recursive: true });
	let folderEncryption = new FolderEncryption('password', './test', './test.1');

	folderEncryption.sync();
	const expectedStats = Object.assign(new FolderEncryptionStats(), {
		sourceFolders: 1,
		deletedFolders: 0,
		sourceFiles: 3,
		newFiles: 3,
		updatedFiles: 0,
		deletedFiles: 0
	});
	assert.deepEqual(folderEncryption.stats, expectedStats);

	expectedStats.newFiles = 0;
	folderEncryption.sync();
	assert.deepEqual(folderEncryption.stats, expectedStats);

	folderEncryption = new FolderEncryption('password', './test.1', './test.0');
	folderEncryption.unpack();

	fs.rmdirSync('./test.1', { recursive: true });
});
