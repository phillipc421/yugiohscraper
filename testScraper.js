const loadSubPage2 = async (url, browser) => {
	// undefined url
	if (!url) return;
	try {
		const subPage = await browser.newPage();
		await subPage.goto(URL_BASE + url, { waitUntil: ["domcontentloaded"] });
		const setData = await getSetData(subPage, url);
		console.log(setData);
		// close sub page
		await subPage.close();
		return setData;
	} catch (e) {
		console.log("Error loading subpage...", e);
	}
};

const chunkLoad2 = async (maxTabs, links, browser) => {
	let data = [];
	const linksLength = links.length;
	for (let i = 0; i < linksLength; i += maxTabs) {
		console.log(i, i + maxTabs - 1);
		const promises = [];
		for (j = i; j < i + maxTabs; j++) {
			promises.push(loadSubPage2(links[j], browser));
		}
		// do not continue until this chunk of pages is done
		const results = await Promise.allSettled(promises);

		const values = results.map((r) => r.value);
		data = data.concat(values);
	}
	await fs.writeFile("results.json", JSON.stringify(data), "utf-8");

	// duplicate checks
	const dupes = {};
	data.forEach((setName) => {
		if (dupes[setName]) {
			console.log("Duplicate of", setName, "found!");
			dupes[setName]++;
		} else {
			dupes[setName] = 1;
		}
	});
	console.log(data.length);
	// log it
	await fs.writeFile("sets.txt", data.join("\n"), "utf-8");
	await fs.writeFile("dupes.json", JSON.stringify(dupes), "utf-8");
};

const getSetData = async (page, link) => {
	const data = {};
	try {
		const setTitle = await page.$eval(
			"#broad_title h1>strong",
			(title) => title.textContent
		);
		data.setTitle = setTitle;
		data.referer = URL_BASE + link;
	} catch (e) {
		console.log(e);
	}
	return data;
};
