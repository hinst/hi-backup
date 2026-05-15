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
		const sourceItems = this.readSyncItems(0, this.sourcePath);
		console.log('Source: folders=' + this.stats.sourceFolders + ' files=' + this.stats.sourceFiles);
	}

	private readSyncItems(depth: number, sourcePath: string): FolderSyncItem[] {
		const syncItems: FolderSyncItem[] = [];
		const sourceFiles = fs.readdirSync(sourcePath, { withFileTypes: true });
		for (const entry of sourceFiles) {
			if (depth === 0 && this.checkIgnored(entry.name)) continue;
			syncItems.push(FolderSyncItem.create(depth, entry));
		}
		for (const syncItem of syncItems) {
			switch (syncItem.kind) {
				case FileKind.DIRECTORY: {
					this.stats.sourceFolders++;
					break;
				}
				case FileKind.FILE: {
					this.stats.sourceFiles++;
					break;
				}
			}
			if (syncItem.kind === FileKind.DIRECTORY)
				syncItems.push(...this.readSyncItems(depth + 1, syncItem.path));
		}
		return syncItems;
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
