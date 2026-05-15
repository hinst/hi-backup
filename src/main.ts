import 'source-map-support/register';
import fs from 'node:fs';
import process from 'node:process';
import chalk from 'chalk';
import { FileTransformerGz } from './fileTransformerGz';
import { FolderEncryption } from './folderEncryption';
import { FolderHasher } from './folderHasher';
import { FolderSync } from './folderSync';
import { TaskCommand, TaskConfig } from './taskConfig';

async function main() {
	const configFilePath = process.argv[2];
	if (!configFilePath?.length)
		console.log('Please provide config file path as command line argument');
	console.log('Using config: ' + configFilePath);
	const tasks: TaskConfig[] = JSON.parse(fs.readFileSync(configFilePath).toString());
	if (!tasks?.length) console.warn('There are no tasks');
	for (const taskData of tasks) {
		const taskConfig = Object.assign(TaskConfig.createUndefined(), taskData);
		const completionText =
			chalk.bold('DONE') +
			' ' +
			chalk.green(taskConfig.sourcePath) +
			' ' +
			chalk.bold(taskConfig.command) +
			' ' +
			chalk.cyan(taskConfig.targetPath);

		console.time(completionText);
		taskConfig.validate();
		console.log(taskConfig);
		const mirror = new FolderSync(taskConfig.sourcePath, taskConfig.targetPath);
		switch (taskConfig.command) {
			case TaskCommand.COMPRESS: {
				mirror.fileTransformer = new FileTransformerGz();
				break;
			}
			case TaskCommand.MIRROR: {
				break;
			}
		}
		if (taskConfig.hashOnly) {
			await new FolderHasher(taskConfig.targetPath).check();
		} else {
			await mirror.run();
			console.log(mirror.stats);
		}
		console.timeEnd(completionText);
	}
}

const _ = main();

function oldMain() {
	function requireEnvironmentString(key: string): string {
		const text = process.env[key];
		if (!text?.length) throw new Error('Required string is missing');
		return text;
	}

	const sourceFolder = requireEnvironmentString('source');
	const destinationFolder = requireEnvironmentString('destination');
	const password = requireEnvironmentString('password');
	const unpack = process.env.unpack === 'true';
	const ignoredList = JSON.parse(process.env.ignoredList || '[]');

	console.log((unpack ? 'Unpacking ' : 'Encrypting ') + sourceFolder + ' -> ' + destinationFolder);
	const folderEncryption = new FolderEncryption(
		password,
		sourceFolder,
		destinationFolder,
		ignoredList,
	);
	console.time('done');
	if (unpack) folderEncryption.unpack();
	else folderEncryption.sync();
	console.log(folderEncryption.stats);
	console.timeEnd('done');
}
