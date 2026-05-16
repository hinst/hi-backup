import fs from 'node:fs';
import { Encryption } from './encryption';
import { FileFormatError, FileKind, writeSizedBuffer } from './file';
import { FileTransformer } from './fileTransformer';

export class EncryptionTransformer extends FileTransformer {
	private static ENCRYPTED_FILE_NAME_LENGTH = 32;
	private static INFO_FILE_EXTENSION = '.info';
	private readonly encryption: Encryption;

	constructor(password: string) {
		super();
		this.encryption = new Encryption(password);
	}

	override encodePath(path: string, kind: FileKind): string {
		const parts = path.split('/');
		const encodedPath = parts.map((part) => this.encryptFileName(part)).join('/');
		const encodedFileName = encodedPath[encodedPath.length - 1];
		if (kind === FileKind.DIRECTORY) {
			const infoFilePath =
				this.targetPath + '/' + encodedPath + EncryptionTransformer.INFO_FILE_EXTENSION;
			this.saveFolderName(infoFilePath, encodedFileName);
		}
		return encodedPath;
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

	private saveFolderName(targetPath: string, fileName: string) {
		const file = fs.openSync(targetPath, 'w');
		const noise = Encryption.createNoise();
		fs.writeSync(file, noise, 0, noise.length, null);
		writeSizedBuffer(file, this.encryption.encryptText(noise, fileName));
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
