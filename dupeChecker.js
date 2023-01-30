const fs = require("fs/promises");
const path = require("path");

const dupeChecks = async (data) => {
	// duplicate checks
	const dupes = {};
	let dupeCount = 0;
	data.forEach((setName) => {
		if (dupes[setName]) {
			console.log("Duplicate of", setName, "found!");
			dupeCount++;
			dupes[setName]++;
		} else {
			dupes[setName] = 1;
		}
	});
	console.log("total dupes:", dupeCount);
	// log it
	await fs.writeFile("sets.txt", data.join("\n"), "utf-8");
	await fs.writeFile("dupes.json", JSON.stringify(dupes), "utf-8");
};

const main = async () => {
	const data = await fs.readFile(
		path.join(process.cwd(), "results.json"),
		"utf-8"
	);
	const parsed = JSON.parse(data);
	const newParsed = parsed.slice(0, parsed.length - 1);
	const titles = newParsed.map((set) => set.setTitle);
	const referers = newParsed.map((set) => set.referer);
	console.log(titles.length);
	await dupeChecks(referers);
};

main();
