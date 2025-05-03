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
new FolderEncryption(password, sourceFolder, destinationFolder).sync();
