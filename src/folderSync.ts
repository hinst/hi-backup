import fs from 'node:fs';
import chalk from 'chalk';
import { FileKind } from './file';
import { FilePathTransformer } from './filePathTransformer';
import { FolderSyncStats } from './folderStats';
import { FolderSyncItem } from './folderSyncItem';

export class FolderSync {
	public readonly stats = new FolderSyncStats();
	private filePathTransformer: FilePathTransformer = new FilePathTransformer();

	constructor(
		private readonly sourcePath: string,
		private readonly destinationPath: string,
		private readonly ignoredList: string[] = [],
	) {}

	async run() {
		const sourceItems = this.readSourceItems(this.sourcePath);
	}

	private readSourceItems(sourcePath: string): FolderSyncItem[] {
		const sourceItems: FolderSyncItem[] = [];
		const sourceFiles = fs.readdirSync(sourcePath, { withFileTypes: true });
		for (const entry of sourceFiles) {
			if (sourcePath === this.sourcePath && this.checkIgnored(entry.name)) continue;
			sourceItems.push(FolderSyncItem.create(entry));
		}
		return sourceItems;
	}

	private checkIgnored(fileName: string): boolean {
		return this.ignoredList.some(
			(ignoredFile) => ignoredFile.toLowerCase().trim() === fileName.toLowerCase().trim(),
		);
	}

	// private syncFolder(sourcePath: string, targetPath: string) {
	// 	if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) this.deleteFile(targetPath);
	// 	if (!fs.existsSync(targetPath)) {
	// 		console.log(chalk.green('+d ') + targetPath);
	// 		this.stats.newFolders++;
	// 	}
	// 	fs.mkdirSync(targetPath, { recursive: true });
	// 	const encryptedFileNames = new Set<string>();
	// 	this.syncFolderForward(sourcePath, encryptedFileNames, targetPath);
	// 	this.syncFolderBackward(encryptedFileNames, targetPath);
	// }

	private deleteFile(targetFilePath: string) {
		const decodedTargetPath = this.filePathTransformer.decode(targetFilePath, FileKind.FILE);
		console.log(chalk.red('-f') + ' ' + decodedTargetPath + ' ' + targetFilePath);
		fs.unlinkSync(targetFilePath);
		this.stats.deletedFiles++;
	}
}
