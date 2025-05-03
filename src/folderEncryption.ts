import fs from 'fs';
import path from 'path';
import { Encryption } from './encryption';

const MAX_FILE_NAME_LENGTH = 32;

export class FolderEncryption {
	private readonly encryption: Encryption = new Encryption(this.password);
	private _stats = new FolderEncryptionStats();
	public get stats(): FolderEncryptionStats {
		return this._stats;
	}

	constructor(
		private readonly password: string,
		private readonly sourcePath: string,
		private readonly destinationPath: string
	) {}

	sync() {
		this._stats = new FolderEncryptionStats();
		this.syncFolder(this.sourcePath, this.destinationPath);
	}

	unpack() {
		this._stats = new FolderEncryptionStats();
		this.unpackFolder(this.sourcePath, this.destinationPath);
	}

	private unpackFolder(sourcePath: string, destinationPath: string) {
		const sourceFiles = fs.readdirSync(sourcePath);
		fs.mkdirSync(destinationPath, { recursive: true });
	}

	private createShortEncryptedName(fileName: string): string {
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

	private syncFolder(sourcePath: string, destinationPath: string) {
		fs.mkdirSync(destinationPath, { recursive: true });
		const encryptedFileNames = new Set<string>();
		this.syncFolderForward(sourcePath, encryptedFileNames, destinationPath);
		this.syncFolderBackward(encryptedFileNames, destinationPath);
	}

	private syncFolderForward(
		sourcePath: string,
		encryptedFileNames: Set<string>,
		destinationPath: string
	) {
		const sourceFiles = fs.readdirSync(sourcePath);
		for (const fileName of sourceFiles) {
			const sourceFilePath = path.join(sourcePath, fileName);
			const shortEncryptedName = this.createShortEncryptedName(fileName);
			this.addUniqueFileName(encryptedFileNames, shortEncryptedName);
			const destinationFilePath = path.join(destinationPath, shortEncryptedName);

			const fileInfo = fs.statSync(sourceFilePath);
			if (fileInfo.isFile()) {
				this.syncFile(sourceFilePath, destinationFilePath);
				this._stats.sourceFiles++;
			}
			if (fileInfo.isDirectory()) {
				this.syncFolder(sourceFilePath, destinationFilePath);
				this._stats.sourceFolders++;
			}
		}
	}

	private syncFolderBackward(encryptedFileNames: Set<string>, destinationPath: string) {
		const destinationFiles = fs.readdirSync(destinationPath);
		for (const fileName of destinationFiles) {
			if (!encryptedFileNames.has(fileName)) {
				const destinationFilePath = path.join(destinationPath, fileName);
				const fileInfo = fs.statSync(destinationFilePath);
				if (fileInfo.isFile()) {
					fs.unlinkSync(destinationFilePath);
					this._stats.deletedFiles++;
				} else if (fileInfo.isDirectory()) {
					fs.rmdirSync(destinationFilePath, { recursive: true });
					this._stats.deletedFolders++;
				}
			}
		}
	}

	private syncFile(sourcePath: string, destinationPath: string) {
		let isEqual = false;
		if (fs.existsSync(destinationPath) && fs.statSync(destinationPath).isDirectory()) {
			fs.rmdirSync(destinationPath, { recursive: true });
			this._stats.deletedFolders++;
		}
		if (fs.existsSync(destinationPath)) {
			isEqual = this.encryption.compareFileWithEncrypted(sourcePath, destinationPath);
			if (!isEqual) {
				this.encryption.encryptFile(sourcePath, destinationPath);
				this._stats.updatedFiles++;
			}
		} else {
			this.encryption.encryptFile(sourcePath, destinationPath);
			this._stats.newFiles++;
		}
	}
}

export class FolderEncryptionStats {
	public sourceFolders = 0;
	public deletedFolders = 0;
	public sourceFiles = 0;
	public newFiles = 0;
	public updatedFiles = 0;
	public deletedFiles = 0;
}
