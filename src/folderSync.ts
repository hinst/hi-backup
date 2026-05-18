import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { FileKind, joinFilePath, normalizeFilePath } from './file';
import { FileTransformer } from './fileTransformer';
import { FolderHasher, HasherCheckResult } from './folderHasher';
import { FolderSyncStats } from './folderStats';
import { FolderSyncItem } from './folderSyncItem';
import { FolderSyncItemReader } from './folderSyncItemReader';

export class FolderSync {
	ignoredList: string[] = [];
	readonly sourcePath: string;
	readonly targetPath: string;

	public fileTransformer: FileTransformer = new FileTransformer();
	public stats = new FolderSyncStats();

	private readonly targetPaths: Map<string, string> = new Map();
	/** Checking whether files got changed since the previous backup run */
	private readonly beforeHasher: FolderHasher;
	/** Saving hashes after the current backup run */
	private readonly afterHasher: FolderHasher;
	private syncItemIndex = 0;
	private syncItemCount = 0;
	private done = false;

	constructor(sourcePath: string, targetPath: string) {
		this.sourcePath = normalizeFilePath(path.resolve(sourcePath));
		this.targetPath = normalizeFilePath(path.resolve(targetPath));
		this.beforeHasher = new FolderHasher(this.targetPath);
		this.afterHasher = new FolderHasher(this.targetPath);
	}

	async run() {
		if (this.done) throw new Error('Repeated run is not supported');
		else this.done = true;
		this.fileTransformer.sourcePath = this.sourcePath;
		this.fileTransformer.targetPath = this.targetPath;
		if (fs.existsSync(this.sourcePath)) ++this.stats.sourceDirectories;
		else throw new Error('Source path does not exist: ' + this.sourcePath);
		if (!fs.statSync(this.sourcePath).isDirectory())
			throw new Error('Need directory: ' + this.sourcePath);
		if (fs.existsSync(this.beforeHasher.hashesFilePath)) this.beforeHasher.load();

		const itemReader = new FolderSyncItemReader(this.checkIgnored.bind(this));
		const syncItems = itemReader.run(1, this.sourcePath);
		this.stats.sourceDirectories = itemReader.directoryCount;
		this.stats.sourceFiles = itemReader.fileCount;
		this.syncItemCount = syncItems.length;
		console.log(
			'Source [' +
				this.syncItemCount +
				'] directories=' +
				this.stats.sourceDirectories +
				' files=' +
				this.stats.sourceFiles,
		);
		if (!fs.existsSync(this.targetPath)) {
			fs.mkdirSync(this.targetPath);
			++this.stats.newDirectories;
		}
		for (const syncItem of syncItems) {
			await this.syncItem(syncItem);
			++this.syncItemIndex;
		}
		console.log('Sync backwards');
		this.syncItemIndex = -1;
		this.syncBackwards(this.targetPath);
		this.afterHasher.save();
	}

	private checkIgnored(fileName: string): boolean {
		return this.ignoredList.some(
			(ignoredFile) => ignoredFile.toLowerCase().trim() === fileName.toLowerCase().trim(),
		);
	}

	private async syncItem(syncItem: FolderSyncItem) {
		syncItem.validate(this.sourcePath);
		const sourcePath = syncItem.path;
		const sourceRelativePath = sourcePath.substring(this.sourcePath.length + 1);
		const targetRelativePaths = this.encodePath(sourceRelativePath, syncItem.kind);
		const targetPaths = targetRelativePaths.map((targetRelativePath) =>
			joinFilePath(this.targetPath, targetRelativePath),
		);
		for (const targetPath of targetPaths) this.targetPaths.set(targetPath, sourcePath);
		const targetPath = targetPaths[0];
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

	private encodePath(sourceRelativePath: string, kind: FileKind) {
		const paths = this.fileTransformer.encodePath(sourceRelativePath, kind);
		if (!paths?.length) throw new Error('Need at least one path');
		return paths;
	}

	private async syncFile(sourcePath: string, targetPath: string) {
		const exists = fs.existsSync(targetPath);
		if ((await this.beforeHasher.checkFile(targetPath)) === HasherCheckResult.CHANGED)
			console.warn(chalk.yellow('!h') + ' Hash changed: ' + sourcePath + ' -> ' + targetPath);
		if (!exists) {
			this.writeProgress(chalk.green('+f') + ' ' + sourcePath + ' -> ' + targetPath);
			++this.stats.newFiles;
		}
		const changed = await this.fileTransformer.syncFile(sourcePath, targetPath);
		if (exists && changed) {
			this.writeProgress(chalk.cyan('~f') + ' ' + sourcePath + ' -> ' + targetPath);
			++this.stats.updatedFiles;
		}
		await this.afterHasher.readFile(targetPath);
		return changed;
	}

	private syncBackwards(targetPath: string) {
		const fileInfo = fs.statSync(targetPath);
		if (fileInfo.isDirectory()) {
			const entries = fs.readdirSync(targetPath, { withFileTypes: true });
			for (const entry of entries) {
				const itemPath = joinFilePath(targetPath, entry.name);
				this.syncBackwards(itemPath);
			}
		}
		if (this.targetPath !== targetPath && !this.targetPaths.has(targetPath)) {
			if (fileInfo.isDirectory()) this.deleteDirectory('', targetPath);
			if (fileInfo.isFile()) this.deleteFile('', targetPath);
		}
	}

	private deleteFile(sourceFilePath: string, targetFilePath: string) {
		this.writeProgress(chalk.red('-f') + ' ' + sourceFilePath + ' -> ' + targetFilePath);
		fs.unlinkSync(targetFilePath);
		if (targetFilePath !== this.beforeHasher.hashesFilePath) ++this.stats.deletedFiles;
	}

	private deleteDirectory(sourcePath: string, targetPath: string) {
		this.writeProgress(chalk.red('-D') + ' ' + sourcePath + ' -> ' + targetPath);
		fs.rmSync(targetPath, { recursive: true });
		++this.stats.deletedDirectories;
	}

	private createDirectory(sourceFile: string, targetFile: string) {
		this.writeProgress(chalk.green('+D') + ' ' + sourceFile + ' -> ' + targetFile);
		fs.mkdirSync(targetFile, { recursive: true });
		++this.stats.newDirectories;
	}

	private writeProgress(text: string) {
		if (this.syncItemIndex !== -1)
			text = '[' + (this.syncItemIndex + 1) + '/' + this.syncItemCount + '] ' + text;
		console.log(text);
	}
}
