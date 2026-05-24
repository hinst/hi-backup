import fs from 'node:fs';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { joinFilePath, normalizeFilePath, readCountOfFiles, readFileHash } from 'src/files/file';
import { hasKeys } from './object';

export enum HasherCheckResult {
	NO_HASH,
	NO_FILE,
	MATCHED,
	CHANGED,
}

export class FolderHasher {
	static readonly FILE_NAME = '.hashes.json';
	/** Format: mapping relative file path to hash string */
	private hashes: Record<string, string> = {};
	/** Path to JSON file where all file hashes can be stored */
	readonly folderPath: string;
	readonly hashesFilePath: string;
	private readonly progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

	constructor(folderPath: string) {
		this.folderPath = normalizeFilePath(folderPath);
		this.hashesFilePath = joinFilePath(folderPath, FolderHasher.FILE_NAME);
	}

	private toRelativePath(filePath: string): string {
		filePath = normalizeFilePath(filePath);
		if (!filePath.startsWith(this.folderPath))
			throw new Error(
				'File path is outside folder path: ' + filePath + ', must be inside: ' + this.folderPath,
			);
		return filePath.substring(this.folderPath.length + 1);
	}

	async readFile(filePath: string) {
		this.hashes[this.toRelativePath(filePath)] = await readFileHash(filePath);
	}

	async checkFile(filePath: string): Promise<HasherCheckResult> {
		if (!fs.existsSync(filePath)) return HasherCheckResult.NO_FILE;
		const storedHash = this.hashes[this.toRelativePath(filePath)];
		if (!storedHash) return HasherCheckResult.NO_HASH;
		const hash = await readFileHash(filePath);
		return storedHash === hash ? HasherCheckResult.MATCHED : HasherCheckResult.CHANGED;
	}

	async checkAndWarn(filePath: string, sourceFilePath: string, targetFilePath: string) {
		if (![sourceFilePath, targetFilePath].includes(filePath))
			throw new Error(
				'Folder hasher logic error: path mismatch ' +
					JSON.stringify({ filePath, sourceFilePath, targetFilePath }),
			);
		if (!hasKeys(this.hashes)) return;
		switch (await this.checkFile(filePath)) {
			case HasherCheckResult.CHANGED: {
				console.warn(
					chalk.yellow('!h') + ' Hash changed: ' + sourceFilePath + ' -> ' + targetFilePath,
				);
				break;
			}
			case HasherCheckResult.NO_HASH: {
				console.warn(
					chalk.yellow('?h') + ' Hash record missing: ' + sourceFilePath + ' -> ' + targetFilePath,
				);
				break;
			}
		}
	}

	load() {
		const fileText = fs.readFileSync(this.hashesFilePath, 'utf8');
		const storedHashes = JSON.parse(fileText) as Record<string, string>;
		if (typeof storedHashes !== 'object')
			throw new Error('Need object in file: ' + this.hashesFilePath);
		this.hashes = storedHashes;
		return storedHashes;
	}

	loadOptional() {
		if (fs.existsSync(this.hashesFilePath) && fs.statSync(this.hashesFilePath).isFile())
			this.load();
	}

	save() {
		fs.writeFileSync(this.hashesFilePath, JSON.stringify(this.hashes, null, '\t'));
	}

	private async readFolder(folderPath: string) {
		if (folderPath === this.folderPath)
			this.progressBar.start(readCountOfFiles(this.folderPath), 0);
		const files = fs.readdirSync(folderPath, { withFileTypes: true });
		for (const fileInfo of files) {
			const filePath = joinFilePath(folderPath, fileInfo.name);
			if (filePath === this.hashesFilePath) {
				this.progressBar.increment();
				continue;
			}
			if (fileInfo.isDirectory()) {
				await this.readFolder(filePath);
			} else if (fileInfo.isFile()) {
				await this.readFile(filePath);
				this.progressBar.increment();
			}
		}
		if (folderPath === this.folderPath) this.progressBar.stop();
	}

	async fullCheck() {
		const storedHashes = this.load();
		this.hashes = {};
		await this.readFolder(this.folderPath);

		let deviationCount = 0;
		let totalCount = 0;
		const allPaths = new Set<string>([...Object.keys(storedHashes), ...Object.keys(this.hashes)]);
		for (const filePath of [...allPaths].sort()) {
			++totalCount;
			const expectedHash = storedHashes[filePath];
			const actualHash = this.hashes[filePath];
			if (expectedHash === undefined) {
				console.log(chalk.yellow('[!]') + ' Unexpected file: ' + filePath);
				++deviationCount;
				continue;
			}
			if (actualHash === undefined) {
				console.log(chalk.yellow('[!]') + ' Missing file: ' + filePath);
				++deviationCount;
				continue;
			}
			if (actualHash !== expectedHash) {
				console.log(chalk.yellow('[!]') + ' Wrong hash: ' + filePath);
				++deviationCount;
			}
		}

		if (deviationCount > 0)
			console.log(
				'Hash check: deviated ' +
					chalk.yellow(deviationCount) +
					' of total ' +
					totalCount +
					' files',
			);
		else console.log('Hash is ' + chalk.green('OK') + ' for files [' + totalCount + ']');
		return deviationCount;
	}
}
