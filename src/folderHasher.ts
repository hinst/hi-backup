import fs from 'node:fs';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { joinFilePath, readCountOfFiles, readFileHash } from './file';

export class FolderHasher {
	static readonly FILE_NAME = '.hashes.json';
	readonly hashes: Record<string, string> = {};
	readonly hashesFilePath: string;
	private progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

	constructor(readonly folderPath: string) {
		this.hashesFilePath = joinFilePath(folderPath, FolderHasher.FILE_NAME);
	}

	private clear() {
		for (const key of Object.keys(this.hashes)) delete this.hashes[key];
	}

	async generate() {
		this.clear();
		await this.readFolder(this.folderPath);
		fs.writeFileSync(this.hashesFilePath, JSON.stringify(this.hashes, null, '\t'));
	}

	private async readFolder(folderPath: string) {
		if (folderPath === this.folderPath)
			this.progressBar.start(readCountOfFiles(this.folderPath), 0); // Minus one for hashes file itself
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
				this.hashes[filePath] = await readFileHash(filePath);
				this.progressBar.increment();
			}
		}
		if (folderPath === this.folderPath) this.progressBar.stop();
	}

	async check() {
		this.clear();
		if (!fs.existsSync(this.hashesFilePath)) return 0;
		const fileText = fs.readFileSync(this.hashesFilePath, 'utf8');
		const storedHashes = JSON.parse(fileText) as Record<string, string>;
		if (typeof storedHashes !== 'object')
			throw new Error('Need object in file: ' + this.hashesFilePath);
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
