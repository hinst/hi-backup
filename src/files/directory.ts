import fs from 'node:fs';
import { joinFilePath } from 'src/files/file';

export function readCountOfFiles(directory: string) {
	const files = fs.readdirSync(directory, { withFileTypes: true });
	let count = 0;
	for (const file of files) {
		if (file.isFile()) ++count;
		if (file.isDirectory()) count += readCountOfFiles(joinFilePath(file.parentPath, file.name));
	}
	return count;
}

export function findFirstFile(directory: string, ignoredFiles: string[]): string | null {
	ignoredFiles = ignoredFiles.map((ignoredFile) => ignoredFile.toLowerCase());
	const files = fs.readdirSync(directory, { withFileTypes: true });
	for (const file of files) {
		if (ignoredFiles.includes(file.name.toLowerCase())) continue;
		if (file.isFile()) return joinFilePath(file.parentPath, file.name);
		if (file.isDirectory()) {
			const firstFile = findFirstFile(joinFilePath(file.parentPath, file.name), []);
			if (firstFile !== null) return firstFile;
		}
	}
	return null;
}
