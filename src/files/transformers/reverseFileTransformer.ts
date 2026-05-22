import { FileKind } from '../file';
import { FileTransformer } from './fileTransformer';

export class ReverseFileTransformer extends FileTransformer {
	constructor(private readonly transformer: FileTransformer) {
		super();
		this.isReverse = true;
	}

	override encodePath(path: string, kind: FileKind): string[] {
		return this.transformer.decodePath(path, kind);
	}

	override async syncFile(sourcePath: string, targetPath: string): Promise<boolean> {
		return this.transformer.unpackFile(sourcePath, targetPath);
	}

	override decodePath(path: string, kind: FileKind): string[] {
		return this.transformer.encodePath(path, kind);
	}

	override async unpackFile(sourcePath: string, targetPath: string): Promise<boolean> {
		return this.transformer.syncFile(sourcePath, targetPath);
	}
}
