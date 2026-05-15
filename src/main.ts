import 'source-map-support/register';
import fs from 'node:fs';
import process from 'node:process';
import { FolderEncryption } from './folderEncryption';
import { FolderMirroring } from './folderMirroring';
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
		const taskConfig = Object.assign(TaskConfig.createEmpty(), taskData);
		console.time(taskConfig.toString());
		taskConfig.validate();
		console.log(taskConfig);
		switch (taskConfig.command) {
			case TaskCommand.COMPRESS: {
				const mirroring = new FolderMirroring(taskConfig.sourcePath, taskConfig.targetPath);
				await mirroring.sync();
				console.log(mirroring.stats);
				break;
			}
			case TaskCommand.MIRROR: {
				const mirror = new FolderSync(taskConfig.sourcePath, taskConfig.targetPath);
				await mirror.run();
				console.log(mirror.stats);
				break;
			}
		}
		console.timeEnd(taskConfig.toString());
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
