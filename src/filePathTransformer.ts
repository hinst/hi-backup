import { FileKind } from './file';

export class FilePathTransformer {
	encode(path: string, type: FileKind) {
		return path;
	}

	decode(path: string, type: FileKind) {
		return path;
	}
}
