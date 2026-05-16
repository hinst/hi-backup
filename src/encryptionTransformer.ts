import fs from 'node:fs';
import { Encryption } from './encryption';
import { FileFormatError, type FileKind } from './file';
import { FileTransformer } from './fileTransformer';

export class EncryptionTransformer extends FileTransformer {
	private static ENCRYPTED_FILE_NAME_LENGTH = 32;
	private readonly encryption: Encryption;

	constructor(password: string) {
		super();
		this.encryption = new Encryption(password);
	}

	override encodePath(path: string, _: FileKind): string {
		const parts = path.split('/');
		return parts.map((part) => this.encryptFileName(part)).join('/');
	}

	private encryptFileName(fileName: string): string {
		const encryptedFileName = this.encryption.encryptText(
			Encryption.createDefaultNoise(),
			fileName,
		);
		const shortEncryptedName = Encryption.createHash()
			.update(encryptedFileName)
			.digest('hex')
			.slice(0, EncryptionTransformer.ENCRYPTED_FILE_NAME_LENGTH);
		return shortEncryptedName;
	}

	override async syncFile(sourcePath: string, targetPath: string): Promise<boolean> {
		if (!fs.existsSync(targetPath)) {
			this.encryption.encryptFile(sourcePath, targetPath);
			return true;
		}
		let isEqual = false;
		try {
			isEqual = this.encryption.compareEncryptedFile(sourcePath, targetPath);
		} catch (e) {
			if (e instanceof FileFormatError) isEqual = false;
			else throw e;
		}
		if (isEqual) return false;
		this.encryption.encryptFile(sourcePath, targetPath);
		return true;
	}
}
