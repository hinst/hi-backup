import fs from 'node:fs';
import path from 'node:path';
import { FileKind, joinFilePath, normalizeFilePath } from './file';
import { FileTransformer } from './fileTransformer';
import { FolderHasher } from './folderHasher';
import { FolderSyncStats } from './folderStats';
import { FolderSyncItem } from './folderSyncItem';
import { FolderSyncItemReader } from './folderSyncItemReader';

export class FolderUnpack {
	public fileTransformer: FileTransformer = new FileTransformer();
	public stats = new FolderSyncStats();
	readonly sourcePath: string;
	readonly targetPath: string;
	private syncItemIndex = 0;
	private syncItemCount = 0;

	constructor(sourcePath: string, targetPath: string) {
		this.sourcePath = normalizeFilePath(path.resolve(sourcePath));
		this.targetPath = normalizeFilePath(path.resolve(targetPath));
	}

	async run() {
		this.stats = new FolderSyncStats();
		this.fileTransformer.sourcePath = this.sourcePath;
		this.fileTransformer.targetPath = this.targetPath;
		if (fs.existsSync(this.sourcePath)) ++this.stats.sourceDirectories;
		else throw new Error('Source path does not exist: ' + this.sourcePath);
		if (!fs.statSync(this.sourcePath).isDirectory())
			throw new Error('Need directory: ' + this.sourcePath);

		const itemReader = new FolderSyncItemReader(FolderUnpack.checkIgnored);
		const syncItems = itemReader.run(1, this.sourcePath);
		this.stats.sourceDirectories = itemReader.directoryCount;
		this.stats.sourceFiles = itemReader.fileCount;
		this.syncItemCount = syncItems.length;
		console.log(
			'Source [' +
				this.syncItemCount +
				'] folders=' +
				this.stats.sourceDirectories +
				' files=' +
				this.stats.sourceFiles,
		);
		fs.mkdirSync(this.targetPath);
		for (this.syncItemIndex = 0; this.syncItemIndex < syncItems.length; ++this.syncItemIndex)
			await this.unpackItem(syncItems[this.syncItemIndex]);
	}

	private async unpackItem(syncItem: FolderSyncItem) {
		syncItem.validate(this.sourcePath);
		const sourcePath = syncItem.path;
		const sourceRelativePath = sourcePath.substring(this.sourcePath.length + 1);
		const targetRelativePath = this.decodePath(sourceRelativePath, syncItem.kind);
		if (targetRelativePath === '') return;
		const targetPath = joinFilePath(this.targetPath, targetRelativePath);

		await this.fileTransformer.unpackFile(sourcePath, targetPath);

		this.writeProgress(syncItem.toString());
		this.stats.sourceFiles += syncItem.kind === FileKind.FILE ? 1 : 0;
		this.stats.sourceDirectories += syncItem.kind === FileKind.DIRECTORY ? 1 : 0;
	}

	private decodePath(sourceRelativePath: string, kind: FileKind) {
		return this.fileTransformer.decodePath(sourceRelativePath, kind);
	}

	private static checkIgnored(fileName: string) {
		return fileName.toLowerCase() === FolderHasher.FILE_NAME;
	}

	private writeProgress(text: string) {
		text = '[' + (this.syncItemIndex + 1) + '/' + this.syncItemCount + '] ' + text;
		console.log(text);
	}
}
