import test from 'node:test';
import fs from 'fs';
import { FolderEncryption } from './folderEncryption';

test(FolderEncryption.prototype.sync.name, function () {
	const folderEncryption = new FolderEncryption('password', './dist', './test/dist.1');
	folderEncryption.sync();
	console.log(folderEncryption.stats);
	fs.rmdirSync('./test/dist.1', { recursive: true });
});
