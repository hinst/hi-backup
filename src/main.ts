import { Encryption } from './encryption';

function main() {
	new Encryption('password').encryptFile(
		'C:\\Dev\\hi-backup\\.prettierrc',
		'C:\\Dev\\hi-backup\\test\\.prettierrc'
	);
}

main();
