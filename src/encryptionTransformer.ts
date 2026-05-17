import fs from 'node:fs';
import { Encryption } from './encryption';
import { FileFormatError, FileKind, readSizedBuffer, writeSizedBuffer } from './file';
import { FileTransformer } from './fileTransformer';

export class EncryptionTransformer extends FileTransformer {
	private static ENCRYPTED_FILE_NAME_LENGTH = 32;
	private static INFO_FILE_EXTENSION = '.info';
	private readonly encryption: Encryption;

	constructor(password: string) {
		super();
		this.encryption = new Encryption(password);
	}

	override encodePath(path: string, kind: FileKind): string[] {
		const parts = path.split('/');
		const encodedPath = parts.map((part) => this.encryptFileName(part)).join('/');
		const encodedFileName = encodedPath[encodedPath.length - 1];
		const encodedPaths = [encodedPath];
		if (kind === FileKind.DIRECTORY) {
			const infoFilePath = encodedPath + EncryptionTransformer.INFO_FILE_EXTENSION;
			encodedPaths.push(infoFilePath);
			this.saveFolderName(this.targetPath + '/' + infoFilePath, encodedFileName);
		}
		return encodedPaths;
	}

	override decodePath(path: string, kind: FileKind): string {
		if (path.endsWith(EncryptionTransformer.INFO_FILE_EXTENSION)) return '';
		const parts = path.split('/');
		const decodedParts: string[] = [];
		let encryptedPath = '';
		for (let i = 0; i < parts.length; ++i) {
			const encryptedName = parts[i];
			const decodePart = kind === FileKind.DIRECTORY || i < parts.length - 1;
			if (!decodePart) {
				decodedParts.push(encryptedName);
				continue;
			}
			encryptedPath = encryptedPath ? encryptedPath + '/' + encryptedName : encryptedName;
			const infoRelativePath = encryptedPath + EncryptionTransformer.INFO_FILE_EXTENSION;
			const infoPath = this.sourcePath
				? this.sourcePath + '/' + infoRelativePath
				: infoRelativePath;
			decodedParts.push(this.loadFolderName(infoPath));
		}
		return decodedParts.join('/');
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

	override async unpackFile(sourcePath: string, targetPath: string) {}

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
		try {
			const noise = Encryption.createNoise();
			fs.writeSync(file, noise, 0, noise.length, null);
			writeSizedBuffer(file, this.encryption.encryptText(noise, fileName));
		} finally {
			fs.closeSync(file);
		}
	}

	private loadFolderName(sourcePath: string): string {
		const file = fs.openSync(sourcePath, 'r');
		try {
			const noise = Encryption.readNoise(file);
			const buffer = readSizedBuffer(file);
			return this.encryption.decryptText(noise, buffer);
		} finally {
			fs.closeSync(file);
		}
	}
}
