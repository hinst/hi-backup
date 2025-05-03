import fs from 'fs';
import path from 'path';
import { Encryption } from './encryption';

const MAX_FILE_NAME_LENGTH = 32;

export class FolderEncryption {
	private readonly encryption: Encryption = new Encryption(this.password);

	public sourceFolders = 0;
	public deletedFolders = 0;
	public sourceFiles = 0;
	public newFiles = 0;
	public updatedFiles = 0;
	public deletedFiles = 0;

	constructor(
		private readonly password: string,
		private readonly sourcePath: string,
		private readonly destinationPath: string
	) {}

	createShortEncryptedName(fileName: string): string {
		const encryptedFileName = this.encryption.encryptText(
			Encryption.createDefaultNoise(),
			fileName
		);
		const shortEncryptedName = Encryption.createHash()
			.update(encryptedFileName)
			.digest('hex')
			.slice(0, MAX_FILE_NAME_LENGTH);
		return shortEncryptedName;
	}

	private addUniqueFileName(encryptedFileNames: Set<string>, shortEncryptedName: string): void {
		if (encryptedFileNames.has(shortEncryptedName))
			throw new Error('Encrypted file name collision: ' + shortEncryptedName);
		encryptedFileNames.add(shortEncryptedName);
	}

	sync() {
		this.syncFolder(this.sourcePath, this.destinationPath);
	}

	private syncFolder(sourcePath: string, destinationPath: string) {
		const sourceFiles = fs.readdirSync(sourcePath);
		fs.mkdirSync(destinationPath, { recursive: true });
		const encryptedFileNames = new Set<string>();
		for (const fileName of sourceFiles) {
			const sourceFilePath = path.join(sourcePath, fileName);
			const shortEncryptedName = this.createShortEncryptedName(fileName);
			this.addUniqueFileName(encryptedFileNames, shortEncryptedName);
			const destinationFilePath = path.join(destinationPath, shortEncryptedName);

			const fileInfo = fs.statSync(sourceFilePath);
			if (fileInfo.isFile()) {
				this.sourceFiles++;
				this.syncFile(sourceFilePath, destinationFilePath);
			}
			if (fileInfo.isDirectory()) {
				this.sourceFolders++;
				this.syncFolder(sourceFilePath, destinationFilePath);
			}
		}
	}

	private syncFile(sourcePath: string, destinationPath: string) {
		let isEqual = false;
		if (fs.existsSync(destinationPath) && fs.statSync(destinationPath).isDirectory()) {
			fs.rmdirSync(destinationPath, { recursive: true });
			this.deletedFolders++;
		}
		if (fs.existsSync(destinationPath)) {
			isEqual = this.encryption.compareFileWithEncrypted(sourcePath, destinationPath);
			if (!isEqual) {
				this.encryption.encryptFile(sourcePath, destinationPath);
				this.updatedFiles++;
			}
		} else {
			this.encryption.encryptFile(sourcePath, destinationPath);
			this.newFiles++;
		}
	}
}
