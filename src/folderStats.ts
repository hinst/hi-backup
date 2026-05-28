import fs from 'node:fs';

export class FolderSyncStats {
	public sourceDirectories = 0;
	public newDirectories = 0;
	public deletedDirectories = 0;
	public sourceFiles = 0;
	public newFiles = 0;
	public updatedFiles = 0;
	public deletedFiles = 0;
}

export function getFolderSize(directory: string): number {
	const files = fs.readdirSync(directory, { withFileTypes: true });
	let size = 0;
	for (const file of files) {
		const filePath = file.parentPath + '/' + file.name;
		if (file.isFile()) size += fs.statSync(filePath).size;
		if (file.isDirectory()) size += getFolderSize(filePath);
	}
	return size;
}
