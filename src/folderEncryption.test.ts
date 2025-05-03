import test from 'node:test';
import { FolderEncryption } from './folderEncryption';

test(FolderEncryption.prototype.sync.name, function () {
	new FolderEncryption('password', './dist', './test/dist.1').sync();
});
