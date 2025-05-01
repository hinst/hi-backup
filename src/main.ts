import { encryptFile } from './encryption';

async function main() {
	await encryptFile(
		'password',
		'C:\\Dev\\hi-backup\\.prettierrc',
		'C:\\Dev\\hi-backup\\test\\.prettierrc'
	);
}

main();
