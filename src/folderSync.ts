import fs from 'node:fs';
import chalk from 'chalk';
import { FileKind, normalizeFilePath } from './file';
import { FileTransformer } from './fileTransformer';
import { FolderSyncStats } from './folderStats';
import { FolderSyncItem } from './folderSyncItem';

export class FolderSync {
	public readonly stats = new FolderSyncStats();
	private fileTransformer: FileTransformer = new FileTransformer();
	private readonly targetPaths: Set<string> = new Set();

	constructor(
		private readonly sourcePath: string,
		private readonly targetPath: string,
		private readonly ignoredList: string[] = [],
	) {}

	async run() {
		if (!fs.existsSync(this.sourcePath))
			throw new Error('Source path does not exist: ' + this.sourcePath);
		if (!fs.statSync(this.sourcePath).isDirectory())
			throw new Error('Need directory: ' + this.sourcePath);
		const syncItems = this.readSyncItems(1, this.sourcePath);
		console.log('Source: folders=' + this.stats.sourceFolders + ' files=' + this.stats.sourceFiles);
		fs.mkdirSync(this.targetPath, { recursive: true });
		await this.syncItem(new FolderSyncItem(0, this.sourcePath, FileKind.DIRECTORY));
		for (const syncItem of syncItems) await this.syncItem(syncItem);
		this.syncBackwards(this.targetPath);
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

	private async syncItem(syncItem: FolderSyncItem) {
		const sourcePath = syncItem.path;
		this.validateSyncItem(syncItem);
		const sourceRelativePath = sourcePath.substring(this.sourcePath.length);
		const targetRelativePath = this.fileTransformer.encodePath(sourceRelativePath, syncItem.kind);
		const targetPath = this.targetPath + targetRelativePath;
		this.targetPaths.add(targetPath);
		switch (syncItem.kind) {
			case FileKind.DIRECTORY: {
				if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile())
					this.deleteFile(sourcePath, targetPath);
				if (!fs.existsSync(targetPath)) this.createDirectory(sourcePath, targetPath);
				break;
			}
			case FileKind.FILE: {
				if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory())
					this.deleteDirectory(sourcePath, targetPath);
				await this.syncFile(syncItem.path, targetPath);
				break;
			}
		}
	}

	private async syncFile(sourcePath: string, targetPath: string) {
		const exists = fs.existsSync(targetPath);
		if (!exists) console.log(chalk.green('+f') + ' ' + sourcePath + ' -> ' + targetPath);
		const changed = await this.fileTransformer.syncFile(sourcePath, targetPath);
		if (exists && changed) console.log(chalk.cyan('~f') + ' ' + sourcePath + ' -> ' + targetPath);
		return changed;
	}

	private validateSyncItem(syncItem: FolderSyncItem) {
		if (!syncItem.path.startsWith(this.sourcePath))
			throw new Error(
				'Folder sync logic error: source path outside main source path: ' +
					this.sourcePath +
					' -> ' +
					syncItem.path,
			);
		if (!fs.existsSync(syncItem.path))
			throw new Error('Source path does not exist: ' + syncItem.path);
	}

	private syncBackwards(targetPath: string) {
		const stats = fs.statSync(targetPath);
		if (stats.isDirectory()) {
			const entries = fs.readdirSync(targetPath, { withFileTypes: true });
			for (const entry of entries) {
				const itemPath = normalizeFilePath(targetPath + '/' + entry.name);
				this.syncBackwards(itemPath);
			}
		}
		if (!this.targetPaths.has(targetPath)) {
			if (stats.isDirectory()) this.deleteDirectory('', targetPath);
			if (stats.isFile()) this.deleteFile('', targetPath);
		}
	}

	private deleteFile(sourceFilePath: string, targetFilePath: string) {
		console.log(chalk.red('-f') + ' ' + sourceFilePath + ' -> ' + targetFilePath);
		fs.unlinkSync(targetFilePath);
		this.stats.deletedFiles++;
	}

	private deleteDirectory(sourcePath: string, targetPath: string) {
		console.log(chalk.red('-d') + ' ' + sourcePath + ' -> ' + targetPath);
		fs.rmSync(targetPath, { recursive: true });
		this.stats.deletedFolders++;
	}

	private createDirectory(sourceFile: string, targetFile: string) {
		console.log(chalk.green('+d') + ' ' + sourceFile + ' -> ' + targetFile);
		fs.mkdirSync(targetFile, { recursive: true });
		this.stats.newFolders++;
	}
}
