const puppeteer = require("puppeteer");
const fs = require("fs/promises");
const path = require("path");

// official konami card database
const URL = "https://www.db.yugioh-card.com/yugiohdb/card_list.action";
const URL_BASE = "https://www.db.yugioh-card.com";

const getPackLinks = async (page) => {
	const linkSelector = ".link_value"; // selector as of 1/12/23
	try {
		const results = await page.$$eval(linkSelector, (links) =>
			links.map((link) => link.value)
		);
		console.log("Got links for each booster/deck...");
		return results;
	} catch (e) {
		console.log(e);
	}
};

// for use on subpages, builds the actual card data objects
const getCardData = async (page, link, browser) => {
	const data = {};
	try {
		const setTitle = await page.$eval(
			"#broad_title h1>strong",
			(title) => title.textContent
		);
		// ( Release Date : 03/11/2022 ) -- format on website
		const setReleaseDate = await page.$eval(
			"#previewed",
			(releaseDate) =>
				releaseDate.textContent.match(/\d\d\/\d\d\/\d\d\d\d/g)[0]
		);

		data.setTitle = setTitle;
		data.setReleaseDate = setReleaseDate;
		data.referer = URL_BASE + link;
		// cards info is in <dl class="flex_1"> tags
		// const cardDls = await page.$$("dl.flex_1");
		const cardDls = await page.$$(".t_row.c_normal");
		const cardDlPromises = cardDls.map(async (cardDl) => {
			// await getImageData(cardDl, link, browser, URL_BASE, data);
			const imgLink = await cardDl.$eval(
				"div.box_card_img>img",
				(img) => img.src
			);

			const cardName = await cardDl.$eval(
				".card_name",
				(cardName) => cardName.textContent
			);
			const cardAttr = await cardDl.$eval(
				".box_card_attribute>span",
				(cardAttr) => cardAttr.textContent
			);
			let effectType;
			if (cardAttr === "SPELL" || cardAttr === "TRAP") {
				try {
					effectType = await cardDl.$eval(
						".box_card_effect>span",
						(effectType) => effectType.textContent
					);
				} catch (e) {}
			}
			let cardLvl;
			try {
				cardLvl = await cardDl.$eval(
					".box_card_level_rank.level>span",
					(cardLvl) => cardLvl.textContent
				);
			} catch (e) {}

			let cardInfoSpecies;
			try {
				cardInfoSpecies = await cardDl.$eval(
					".card_info_species_and_other_item>span",
					(info) =>
						info.textContent
							.slice(
								info.textContent.indexOf("[") + 1,
								info.textContent.indexOf("]")
							)
							.replace(/[\r\n\t]/g, "")
				);
			} catch (e) {}

			let power = {};
			if (cardInfoSpecies) {
				const atk = await cardDl.$eval(".atk_power>span", (atk) =>
					atk.textContent.replace(/[\t\r\n]/g, "")
				);
				const def = await cardDl.$eval(".def_power>span", (def) =>
					def.textContent.replace(/[\t\r\n]/g, "")
				);
				power.atk = atk;
				power.def = def;
			}

			let cardEffect;
			try {
				cardEffect = await cardDl.$eval(
					".box_card_text.c_text.flex_1",
					(cardEffect) =>
						cardEffect.textContent.replace(/[\t\r\n]/g, "")
				);
			} catch (e) {}
			if (!cardEffect) cardEffect = "Normal";
			return cardAttr === "TRAP" || cardAttr === "SPELL"
				? {
						imgLink,
						cardName,
						cardAttr,
						effectType,
						cardEffect,
				  }
				: {
						imgLink,
						cardName,
						cardAttr,
						cardLvl,
						cardInfoSpecies,
						power,
						cardEffect,
				  };
		});
		// puppeteer .$eval() rejects if the css selector cannot be found...
		// thus we use Promise.allSettled vs .all so the entire collection does not reject
		return Promise.allSettled(cardDlPromises).then((results) => {
			data.cards = results.map((result) => result.value);
			data.cardsInSet = data.cards.length;
			console.log("Writing file: ", data.setTitle + ".json");
			fs.writeFile(
				path.join(
					process.cwd(),
					"packs",
					data.setTitle.replace(":", "_") + ".json"
				),
				JSON.stringify(data)
			).catch((e) => console.log(e));
		});
	} catch (e) {
		console.log(e);
	}
};

// get links to all booster, structure deck, etc. pages
const loadMainPage = async (getPackLinks, loadSubPage) => {
	try {
		// load puppeteer headless browser
		const browser = await puppeteer.launch({
			headless: true,
		});
		const mainPage = await browser.newPage();
		await mainPage.goto(URL, { waitUntil: ["domcontentloaded"] });
		// make sure page loaded.
		console.log(URL + " loaded...");
		const links = await getPackLinks(mainPage);
		// close mainPage
		await mainPage.close();
		// loop through all links/pages and run the scraper
		if (mainPage.isClosed()) {
			console.log("its closed");
			// await chunkLoad(10, links, browser);
			await loadSubPage(links[6], browser);
			console.log("Closing browser session...");
			await browser.close();
		}
	} catch (e) {
		console.error(e);
	}
};

// load a new page for each link for efficiency?
const loadSubPage = async (url, browser) => {
	console.log("Loading subpage for " + url);
	try {
		const subPage = await browser.newPage();
		await subPage.goto(URL_BASE + url, { waitUntil: ["domcontentloaded"] });
		await getCardData(subPage, url, browser);
		// close sub page
		console.log("Completed crawling: " + url);
		console.log("Closing tab...");
		await subPage.close();
	} catch (e) {
		console.log("Error loading subpage...", e);
	}
};

// const chunk load tabs to prevent crash
const chunkLoad = async (maxTabs, links, browser) => {
	for (let i = 0; i < links.length; i += maxTabs) {
		console.log("Processing: ", i, i + maxTabs - 1);
		const promises = [];
		for (j = i; j < i + maxTabs; j++) {
			promises.push(loadSubPage(links[j], browser));
		}
		// do not continue until this chunk of pages is done
		await Promise.allSettled(promises);
	}
};

// images on the site only come back if the referer header is the current url
// image comes back as an octet/stream
const getImageData = async (element, link, browser, URL_BASE, data) => {
	// console.log("ELEMENT", element);

	const imageSource = await element.$eval(
		"div.box_card_img>img",
		(img) => img.src
	);
	console.log("IMAGE", imageSource);
	try {
		const response = await fetch(imageSource, {
			headers: {
				Referer: URL_BASE + link,
			},
		});
		const imgData = await response.arrayBuffer();
		await fs.writeFile(
			path.join(
				process.cwd(),
				"packs",
				data.setTitle.replace(":", "_") + ".png"
			),
			Buffer.from(imgData)
		);
	} catch (e) {
		console.log(e);
	}

	// load image in new page with referer set to origin page
	// const imgPage = await browser.newPage();
	// listen for responses
	// imgPage.on("response", async (res) => {
	// 	if (res.request().method() === "OPTIONS") {
	// 		console.log("Was a preflight");
	// 		return;
	// 	}
	// 	if (res.headers()["content-type"].includes("octet-stream")) {
	// 		console.log(res.url());
	// 		setTimeout(async () => {
	// 			try {
	// 				const imgBuffer = await res.buffer();
	// 				console.log("THE BUFFER", imgBuffer);

	// 				await fs.writeFile(
	// 					path.join(process.cwd(), "packs", "myimg.png"),
	// 					imgBuffer,
	// 					"base64"
	// 				);
	// 			} catch (e) {
	// 				console.log(e);
	// 			}
	// 		}, 1000);
	// 	}
	// });
	// const response = await imgPage.goto(imageSource, {
	// 	referer: URL_BASE + link,
	// });
	// const response = await imgPage.goto(imageSource);
	console.log("RESPONSE", response);
	// const imgBuffer = await imgPageResponse.buffer();
	// // write img
	// await fs.writeFile(
	// 	path.join(
	// process.cwd(),
	// "packs",
	// data.setTitle.replace(":", "_") + ".png"
	// 	),
	// 	imgBuffer
	// );
	// close img page
	// await imgPage.close();
};

// loadMainPage(getPackLinks, loadSubPage);
// colons do not throw an error but are invalid on windows. Causes empty files to be made.
// fs.writeFile(
// 	"C:\\Users\\phill\\development\\yugiohscraper\\ass: the balls.json",
// 	"{'data': 'mydata'}"
// ).catch((e) => console.log(e));

// console.log(process.cwd());

module.exports = {
	loadMainPage,
	getPackLinks,
	loadSubPage,
};
