import fs from 'node:fs';
import chalk from 'chalk';
import { FileKind } from './file';
import { FilePathTransformer } from './filePathTransformer';
import { FolderSyncStats } from './folderStats';

export class FolderSync {
	public readonly stats = new FolderSyncStats();
	private filePathTransformer: FilePathTransformer = new FilePathTransformer();

	constructor(
		private readonly sourcePath: string,
		private readonly destinationPath: string,
		private readonly ignoredList: string[] = [],
	) {}

	async run() {
		this.syncFolder(this.sourcePath, this.destinationPath);
	}

	private checkIgnored(fileName: string): boolean {
		return this.ignoredList.some(
			(ignoredFile) => ignoredFile.toLowerCase().trim() === fileName.toLowerCase().trim(),
		);
	}

	protected getTargetFilePath(destinationPath: string): string;

	private syncFolder(sourcePath: string, targetPath: string) {
		if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) this.deleteFile(targetPath);
		if (!fs.existsSync(targetPath)) {
			console.log(chalk.green('+d ') + targetPath);
			this.stats.newFolders++;
		}
		fs.mkdirSync(targetPath, { recursive: true });
		const encryptedFileNames = new Set<string>();
		this.syncFolderForward(sourcePath, encryptedFileNames, targetPath);
		this.syncFolderBackward(encryptedFileNames, targetPath);
	}

	private deleteFile(targetFilePath: string) {
		const decodedTargetPath = this.filePathTransformer.decode(targetFilePath, FileKind.FILE);
		console.log(chalk.red('-f') + ' ' + decodedTargetPath + ' ' + targetFilePath);
		fs.unlinkSync(targetFilePath);
		this.stats.deletedFiles++;
	}
}
