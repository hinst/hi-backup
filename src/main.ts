import 'source-map-support/register';
import fs from 'node:fs';
import process from 'node:process';
import chalk from 'chalk';
import { EncryptionTransformer as EncryptionFileTransformer } from 'src/files/transformers/encryptionTransformer';
import { GzipFileTransformer } from 'src/files/transformers/gzipFileTransformer';
import { FolderHasher } from 'src/folderHasher';
import { FolderSync } from 'src/folderSync';
import { TaskCommand, TaskConfig } from 'src/taskConfig';

async function main() {
	const configFilePath = process.argv[2];
	if (!configFilePath?.length)
		return console.warn('Please provide config file path as command line argument');
	console.log('Using config: ' + configFilePath);
	const taskConfigs: TaskConfig[] = JSON.parse(fs.readFileSync(configFilePath).toString());
	if (!taskConfigs?.length) console.warn('There are no tasks');
	for (let i = 0; i < taskConfigs.length; ++i) {
		const taskConfig = Object.assign(TaskConfig.createUndefined(), taskConfigs[i]);
		console.log('[' + i + '] ' + taskConfig.toColoredString());
		const completionText = chalk.bold('DONE') + ' ' + taskConfig.toColoredString();
		console.time(completionText);
		await runTask(taskConfig);
		console.timeEnd(completionText);
		const isLastTask = i === taskConfigs.length - 1;
		if (!isLastTask)
			console.log();
	}
}

const folderSyncCommands = [TaskCommand.MIRROR, TaskCommand.COMPRESS, TaskCommand.ENCRYPT];

async function runTask(taskConfig: TaskConfig) {
	if (TaskCommand.CHECK_HASH === taskConfig.command) {
		await new FolderHasher(taskConfig.targetPath).fullCheck();
		return;
	}
	if (folderSyncCommands.includes(taskConfig.command)) {
		const folderSync = new FolderSync(taskConfig.sourcePath, taskConfig.targetPath);
		if (taskConfig.command === TaskCommand.COMPRESS)
			folderSync.fileTransformer = new GzipFileTransformer();
		if (taskConfig.command === TaskCommand.ENCRYPT) {
			if (!taskConfig.password?.length) throw new Error('Need password for encryption');
			folderSync.fileTransformer = new EncryptionFileTransformer(taskConfig.password);
		}
		folderSync.ignoredList = taskConfig.ignoredList;
		await folderSync.run();
		console.log(folderSync.stats);
		return;
	}
	throw new Error('Unknown command: ' + taskConfig.command);
}

const _ = main();
