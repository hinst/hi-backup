import 'source-map-support/register';
import fs from 'fs';

fs.readdirSync('dist').forEach((file) => {
	if (file.endsWith('.test.js')) {
		console.log(`Running ${file}`);
		require('./' + file);
	}
});
