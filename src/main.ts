import 'source-map-support/register';
import process from 'process';
import { FolderEncryption } from './folderEncryption';

function requireEnvironmentString(key: string): string {
	const text = process.env[key];
	if (!text?.length) throw new Error('Required string is missing');
	return text;
}

const sourceFolder = requireEnvironmentString('source');
const destinationFolder = requireEnvironmentString('destination');
const password = requireEnvironmentString('password');
const unpack = process.env['unpack'] === 'true';
const ignoredList = JSON.parse(process.env['ignoredList'] || '[]');

console.log((unpack ? 'Unpacking ' : 'Encrypting ') + sourceFolder + ' -> ' + destinationFolder);
const folderEncryption = new FolderEncryption(
	password,
	sourceFolder,
	destinationFolder,
	ignoredList
);
console.time('\tdone');
if (unpack) folderEncryption.unpack();
else folderEncryption.sync();
console.timeEnd('\tdone');
console.log(folderEncryption.stats);
