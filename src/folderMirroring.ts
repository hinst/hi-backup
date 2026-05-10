import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { compareCompressedFile, compressFileGzip, GZIP_FILE_EXTENSION } from './compression';
import { FileFormatError } from './file';
import { FolderSyncStats } from './folderStats';

export class FolderMirroring {
	public readonly stats = new FolderSyncStats();

	constructor(
		private readonly sourcePath: string,
		private readonly targetPath: string,
		private readonly ignoredList: string[] = [],
	) {}

	async sync() {
		await this.syncFolder(this.sourcePath, this.targetPath);
	}

	private async syncFolder(sourcePath: string, targetPath: string) {
		if (!fs.existsSync(sourcePath))
			throw new Error('Source path does not exist: ' + this.sourcePath);
		if (!fs.statSync(sourcePath).isDirectory())
			throw new Error('Source path for folder syncing must be a directory');

		if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) this.deleteFile(targetPath);
		if (!fs.existsSync(targetPath)) this.createNewFolder(targetPath);
		await this.syncFolderForward(sourcePath, targetPath);
		this.syncFolderBackward(sourcePath, targetPath);
	}

	private createNewFolder(targetPath: string) {
		console.log(chalk.green('+d ') + targetPath);
		fs.mkdirSync(targetPath, { recursive: true });
		this.stats.newFolders++;
	}

	private async syncFolderForward(sourcePath: string, targetPath: string) {
		const sourceFiles = fs.readdirSync(sourcePath);
		for (const fileName of sourceFiles) {
			if (sourcePath === this.sourcePath && this.checkIgnored(fileName)) continue;
			const sourceFilePath = path.join(sourcePath, fileName);
			const destinationFilePath = path.join(targetPath, fileName);

			const fileInfo = fs.statSync(sourceFilePath);
			if (fileInfo.isFile()) {
				await this.syncFile(sourceFilePath, destinationFilePath);
				this.stats.sourceFiles++;
			}
			if (fileInfo.isDirectory()) {
				await this.syncFolder(sourceFilePath, destinationFilePath);
				this.stats.sourceFolders++;
			}
		}
	}

	private async syncFile(sourcePath: string, targetPath: string) {
		targetPath += GZIP_FILE_EXTENSION;
		if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory())
			this.deleteFolder(targetPath);
		if (fs.existsSync(targetPath)) {
			let isEqual = false;
			let isDamaged = false;
			try {
				isEqual = await compareCompressedFile(sourcePath, targetPath);
			} catch (e) {
				if (e instanceof FileFormatError) isDamaged = false;
				else throw e;
			}
			if (!isEqual) {
				console.log(
					(isDamaged ? chalk.yellow('xf ') : chalk.blue('~f ')) +
						sourcePath +
						chalk.blue(' -> ') +
						targetPath,
				);
				await compressFileGzip(sourcePath, targetPath);
				this.stats.updatedFiles += 1;
			}
		} else {
			console.log(chalk.greenBright('+f ') + sourcePath + ' -> ' + targetPath);
			await compressFileGzip(sourcePath, targetPath);
			this.stats.newFiles++;
		}
	}

	private syncFolderBackward(sourcePath: string, targetPath: string) {
		const targetFiles = fs.readdirSync(targetPath, { withFileTypes: true });
		for (const targetFile of targetFiles) {
			const targetFilePath = targetPath + '/' + targetFile.name;
			let sourceFilePath = sourcePath + '/' + targetFile.name;
			if (targetFile.isFile())
				if (targetFile.name.endsWith(GZIP_FILE_EXTENSION)) {
					console.log('a', sourceFilePath, targetFilePath);
					sourceFilePath = sourceFilePath.substring(
						0,
						sourceFilePath.length - GZIP_FILE_EXTENSION.length,
					);
					console.log('b', sourceFilePath, targetFilePath);
					if (!fs.existsSync(sourceFilePath) || !fs.statSync(sourceFilePath).isFile())
						this.deleteFile(targetFilePath);
				} else this.deleteFile(targetFilePath);
			if (targetFile.isDirectory())
				if (!fs.existsSync(sourceFilePath) || !fs.statSync(sourceFilePath).isDirectory())
					this.deleteFolder(targetFilePath);
		}
	}

	private deleteFile(targetFilePath: string) {
		console.log(chalk.red('-f') + ' ' + targetFilePath);
		fs.unlinkSync(targetFilePath);
		this.stats.deletedFiles++;
	}

	private deleteFolder(targetPath: string) {
		fs.rmSync(targetPath, { recursive: true });
		console.log(chalk.red('-d ') + targetPath);
		this.stats.deletedFolders++;
	}

	private checkIgnored(fileName: string): boolean {
		return this.ignoredList.some(
			(ignoredFile) => ignoredFile.toLowerCase().trim() === fileName.toLowerCase().trim(),
		);
	}
}
