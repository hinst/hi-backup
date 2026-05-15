import fs from 'node:fs';
import { joinFilePath, readFileHash } from './file';

const HASHES_FILE_NAME = '.hashes.json';

export class FolderHasher {
	readonly hashes: Record<string, string> = {};
	readonly hashesFilePath: string;

	constructor(readonly folderPath: string) {
		this.hashesFilePath = joinFilePath(folderPath, HASHES_FILE_NAME);
	}

	async generate() {
		await this.readFolder(this.folderPath);
		fs.writeFileSync(this.hashesFilePath, JSON.stringify(this.hashes, null, '\t'));
	}

	private async readFolder(folderPath: string) {
		const files = fs.readdirSync(folderPath, { withFileTypes: true });
		for (const fileInfo of files) {
			const filePath = joinFilePath(folderPath, fileInfo.name);
			if (filePath === this.hashesFilePath) continue;
			if (fileInfo.isDirectory()) {
				await this.readFolder(filePath);
			} else if (fileInfo.isFile()) this.hashes[filePath] = await readFileHash(filePath);
		}
	}
}
