import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { compressFile } from './compression';
import { FolderSyncStats } from './folderStats';

const GZ_FILE_EXTENSION = '.gz';

export class FolderMirroring {
	private readonly stats = new FolderSyncStats();

	constructor(
		private readonly sourcePath: string,
		private readonly destinationPath: string,
		private readonly ignoredList: string[] = [],
	) {}

	async sync() {
		await this.syncFolder(this.sourcePath, this.destinationPath);
	}

	private async syncFolder(sourcePath: string, destinationPath: string) {
		if (!fs.existsSync(sourcePath))
			throw new Error('Source path does not exist: ' + this.sourcePath);
		if (!fs.statSync(sourcePath).isDirectory()) throw new Error('Source path is not a directory');

		if (fs.existsSync(destinationPath) && fs.statSync(destinationPath).isFile()) {
			console.log(chalk.redBright('-f ') + destinationPath);
			fs.unlinkSync(destinationPath);
			this.stats.deletedFiles++;
		}
		if (!fs.existsSync(destinationPath)) {
			console.log(chalk.green('+d ') + destinationPath);
			fs.mkdirSync(destinationPath, { recursive: true });
			this.stats.newFolders++;
		}
		await this.syncFolderForward(sourcePath, destinationPath);
		this.syncFolderBackward(sourcePath, destinationPath);
	}

	private async syncFolderForward(sourcePath: string, destinationPath: string) {
		const sourceFiles = fs.readdirSync(sourcePath);
		for (const fileName of sourceFiles) {
			if (sourcePath === this.sourcePath && this.checkIgnored(fileName)) continue;
			const sourceFilePath = path.join(sourcePath, fileName);
			const destinationFilePath = path.join(destinationPath, fileName);

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

	private async syncFile(sourceFilePath: string, destinationFilePath: string) {
		if (fs.existsSync(destinationFilePath) && fs.statSync(destinationFilePath).isDirectory()) {
			fs.rmSync(destinationFilePath, { recursive: true });
			console.log(chalk.red('-d ') + destinationFilePath);
		}
		await compressFile(sourceFilePath, destinationFilePath);
	}

	private syncFolderBackward(sourcePath: string, destinationPath: string) {}

	private checkIgnored(fileName: string): boolean {
		return this.ignoredList.some(
			(ignoredFile) => ignoredFile.toLowerCase().trim() === fileName.toLowerCase().trim(),
		);
	}
}
