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
		if (!fs.existsSync(this.sourcePath))
			throw new Error('Source path does not exist: ' + this.sourcePath);
		if (!fs.statSync(this.sourcePath).isDirectory())
			throw new Error('Need directory: ' + this.sourcePath);
		const syncItems = this.readSyncItems(1, this.sourcePath);
		console.log('Source: folders=' + this.stats.sourceFolders + ' files=' + this.stats.sourceFiles);
		fs.mkdirSync(this.destinationPath, { recursive: true });
		await this.syncFolder(new FolderSyncItem(0, this.sourcePath, FileKind.DIRECTORY));
		for (const syncItem of syncItems) {
			if (syncItem.kind === FileKind.DIRECTORY) {
				await this.syncFolder(syncItem);
			}
		}
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

	private async syncFolder(syncItem: FolderSyncItem) {
		const sourceDirPath = syncItem.path;
		this.validateSourcePath(sourceDirPath);
		const sourceRelativePath = sourceDirPath.substring(this.sourcePath.length);
		const targetRelativePath = this.filePathTransformer.encode(
			sourceRelativePath,
			FileKind.DIRECTORY,
		);
		const targetDirPath = this.destinationPath + targetRelativePath;
		if (fs.existsSync(targetDirPath) && !fs.statSync(targetDirPath).isDirectory())
			this.deleteFile(sourceDirPath, targetDirPath);
		if (!fs.existsSync(targetDirPath)) this.createDirectory(sourceDirPath, targetDirPath);
	}

	private validateSourcePath(sourcePath: string) {
		if (!sourcePath.startsWith(this.sourcePath))
			throw new Error(
				'Folder sync logic error: source path outside main source path: ' +
					this.sourcePath +
					' -> ' +
					sourcePath,
			);
		if (!fs.existsSync(sourcePath)) throw new Error('Source path does not exist: ' + sourcePath);
	}

	private deleteFile(sourceFilePath: string, targetFilePath: string) {
		console.log(chalk.red('-f') + ' ' + sourceFilePath + ' ' + targetFilePath);
		fs.unlinkSync(targetFilePath);
		this.stats.deletedFiles++;
	}

	private createDirectory(sourceFile: string, targetFile: string) {
		console.log(chalk.green('+d') + ' ' + sourceFile + ' ' + targetFile);
		fs.mkdirSync(targetFile, { recursive: true });
		this.stats.newFolders++;
	}
}
