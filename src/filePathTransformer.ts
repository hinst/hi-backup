import { FileType } from "./file";

export class FilePathTransformer {
	encode(path: string, type: FileType) {
		return path;
	}

	decode(path: string, type: FileType) {
		return path;
	}
}