import fs from 'fs';
import path from 'path';
import { Encryption } from './encryption';

const MAX_FILE_NAME_LENGTH = 32;

export class FolderEncryption {
	private readonly encryption: Encryption = new Encryption(this.password);
	constructor(
		private readonly password: string,
		private readonly sourcePath: string,
		private readonly destinationPath: string
	) {}

	sync() {
		const files = fs.readdirSync(this.sourcePath);
		fs.mkdirSync(this.destinationPath, { recursive: true });
		const encryptedFileNames = new Set<string>();
		for (const fileName of files) {
			const encryptedFileName = this.encryption.encryptText(
				Encryption.createDefaultNoise(),
				fileName
			);
			const shortEncryptedName = Encryption.createHash()
				.update(encryptedFileName)
				.digest('hex')
				.slice(0, MAX_FILE_NAME_LENGTH);
			if (encryptedFileNames.has(shortEncryptedName))
				throw new Error('Encrypted file name collision: ' + shortEncryptedName);
			encryptedFileNames.add(shortEncryptedName);
			this.encryption.encryptFile(
				path.join(this.sourcePath, fileName),
				path.join(this.destinationPath, shortEncryptedName)
			);
		}
	}
}
