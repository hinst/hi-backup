import fs from 'fs';
import path from 'path';
import { Encryption } from './encryption';
import { FileFormatError, readBufferFromFile, writeBufferToFile } from './file';
import chalk from 'chalk';

const MAX_FILE_NAME_LENGTH = 32;
const INFO_FILE_EXTENSION = '.info';

export class FolderEncryption {
	private readonly encryption: Encryption = new Encryption(this.password);
	private _stats = new FolderEncryptionStats();
	public get stats(): FolderEncryptionStats {
		return this._stats;
	}

	constructor(
		private readonly password: string,
		private readonly sourcePath: string,
		private readonly destinationPath: string,
		private readonly ignoredList: string[] = []
	) {}

	sync() {
		this._stats = new FolderEncryptionStats();
		this.syncFolder(this.sourcePath, this.destinationPath);
	}

	unpack() {
		this._stats = new FolderEncryptionStats();
		this.unpackFolder(this.sourcePath, this.destinationPath);
	}

	private checkIgnored(fileName: string): boolean {
		return this.ignoredList.some(
			(ignoredFile) => ignoredFile.toLowerCase().trim() === fileName.toLowerCase().trim()
		);
	}

	private unpackFolder(sourceFolderPath: string, destinationFolderPath: string) {
		const sourceFiles = fs.readdirSync(sourceFolderPath);
		fs.mkdirSync(destinationFolderPath, { recursive: true });
		for (const fileName of sourceFiles) {
			if (fileName.endsWith(INFO_FILE_EXTENSION)) continue;
			const sourcePath = path.join(sourceFolderPath, fileName);
			const fileInfo = fs.statSync(sourcePath);
			if (fileInfo.isFile()) {
				this.encryption.decryptFile(sourcePath, destinationFolderPath);
				this.stats.sourceFiles++;
			}
			if (fileInfo.isDirectory()) {
				const realFileName = this.loadFolderName(sourcePath + INFO_FILE_EXTENSION);
				const destinationFilePath = path.join(destinationFolderPath, realFileName);
				this.unpackFolder(sourcePath, destinationFilePath);
			}
		}
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
		if (fs.existsSync(destinationPath) && fs.statSync(destinationPath).isFile()) {
			console.log(
				chalk.redBright('-f ') +
					destinationPath +
					'\n\t' +
					this.encryption.decryptFileName(destinationPath)
			);
			fs.unlinkSync(destinationPath);
			this._stats.deletedFiles++;
		}
		if (!fs.existsSync(destinationPath)) {
			console.log(chalk.green('+d ') + destinationPath);
			this._stats.newFolders++;
		}
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
			if (sourcePath === this.sourcePath && this.checkIgnored(fileName)) continue;
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
				this.saveFolderName(destinationFilePath + INFO_FILE_EXTENSION, fileName);
				this.syncFolder(sourceFilePath, destinationFilePath);
				this._stats.sourceFolders++;
			}
		}
	}

	private saveFolderName(destinationFilePath: string, fileName: string) {
		const file = fs.openSync(destinationFilePath, 'w');
		const noise = Encryption.createNoise();
		fs.writeSync(file, noise, 0, noise.length, null);
		writeBufferToFile(file, this.encryption.encryptText(noise, fileName));
	}

	private loadFolderName(destinationFilePath: string): string {
		const file = fs.openSync(destinationFilePath, 'r');
		const noise = Encryption.readNoise(file);
		const buffer = readBufferFromFile(file);
		const fileName = this.encryption.decryptText(noise, buffer);
		fs.closeSync(file);
		return fileName;
	}

	private syncFolderBackward(encryptedFileNames: Set<string>, destinationPath: string) {
		const destinationFiles = fs.readdirSync(destinationPath);
		for (const fileName of destinationFiles) {
			if (fileName.endsWith(INFO_FILE_EXTENSION)) continue;
			if (!encryptedFileNames.has(fileName)) {
				const destinationFilePath = path.join(destinationPath, fileName);
				const fileInfo = fs.statSync(destinationFilePath);
				if (fileInfo.isFile()) {
					console.log(
						chalk.redBright('-f ') +
							destinationFilePath +
							'\n\t' +
							this.encryption.decryptFileName(destinationFilePath)
					);
					fs.unlinkSync(destinationFilePath);
					this._stats.deletedFiles++;
				} else if (fileInfo.isDirectory()) {
					const folderName = this.deleteEncryptedFolder(destinationFilePath);
					console.log(chalk.red('-d ') + destinationFilePath + '\n\t' + folderName);
					this._stats.deletedFolders++;
				}
			}
		}
	}

	private deleteEncryptedFolder(path: string) {
		fs.rmSync(path, { recursive: true });
		const infoPath = path + INFO_FILE_EXTENSION;
		let name = '';
		if (fs.existsSync(infoPath)) {
			name = this.loadFolderName(infoPath);
			fs.unlinkSync(infoPath);
		}
		return name;
	}

	private syncFile(sourcePath: string, destinationPath: string) {
		let isEqual = false;
		let isDamaged = false;
		if (fs.existsSync(destinationPath) && fs.statSync(destinationPath).isDirectory()) {
			const folderName = this.deleteEncryptedFolder(destinationPath);
			console.log(chalk.red('-d ') + destinationPath + '\n\t' + folderName);
			this._stats.deletedFolders++;
		}
		if (fs.existsSync(destinationPath)) {
			try {
				isEqual = this.encryption.compareFileWithEncrypted(sourcePath, destinationPath);
			} catch (e) {
				if (e instanceof FileFormatError) {
					isEqual = false;
					isDamaged = true;
				}
			}
			if (!isEqual) {
				console.log(
					(isDamaged ? chalk.yellow('xf ') : chalk.blue('~f ')) +
						sourcePath +
						' -> ' +
						destinationPath
				);
				this.encryption.encryptFile(sourcePath, destinationPath);
				this._stats.updatedFiles++;
			}
		} else {
			console.log(chalk.greenBright('+f ') + sourcePath + ' -> ' + destinationPath);
			this.encryption.encryptFile(sourcePath, destinationPath);
			this._stats.newFiles++;
		}
	}
}

export class FolderEncryptionStats {
	public sourceFolders = 0;
	public newFolders = 0;
	public deletedFolders = 0;
	public sourceFiles = 0;
	public newFiles = 0;
	public updatedFiles = 0;
	public deletedFiles = 0;
}
