const puppeteer = require("puppeteer");
const fs = require("fs/promises");
const db = require("./db");
const logger = require("./logger");

// official konami card database
const URL = "https://www.db.yugioh-card.com/yugiohdb/card_list.action";
const URL_BASE = "https://www.db.yugioh-card.com";

const insertPacks = async (db, data) => {
	const start = Date.now();
	const response =
		await db`insert into packs (name, release_date, card_count, created_on, image_referer) values (${data.name}, ${data.release_date}, ${data.card_count}, ${data.timeStamp}, ${data.image_referer}) returning *`;
	const { pack_id } = response[0];
	const end = Date.now();
	logger(
		insertPacks.name,
		data.name,
		"Took",
		(end - start) / 1000,
		"seconds"
	);
	return pack_id;
};

const getPackLinks = async (page) => {
	const start = Date.now();
	const linkSelector = ".link_value"; // selector as of 1/12/23
	try {
		const results = await page.$$eval(linkSelector, (links) =>
			links.map((link) => link.value)
		);
		logger("Got links for each booster/deck...");
		const end = Date.now();
		logger(getPackLinks.name, "Took", (end - start) / 1000, "seconds");
		return results;
	} catch (e) {
		logger(e);
	}
};

const getSetData = async () => {};
// for use on subpages, builds the actual card data objects
const getCardData = async (page, link) => {
	const start = Date.now();
	const data = {};
	try {
		let setTitle = "unnamed";
		try {
			setTitle = await page.$eval(
				"#broad_title h1>strong",
				(title) => title.textContent
			);
		} catch (e) {
			logger(e);
		}

		let setReleaseDate = null;
		try {
			// ( Release Date : 03/11/2022 ) -- format on website
			setReleaseDate = await page.$eval(
				"#previewed",
				(releaseDate) =>
					releaseDate.textContent.match(/\d\d\/\d\d\/\d\d\d\d/g)[0]
			);
		} catch (e) {
			logger(e);
		}

		let cardCount = "nocardcount";
		try {
			// cards in set
			cardCount = await page.$eval(
				".sort_set .text",
				(cardCountText) => cardCountText.textContent.match(/\d+/g)[0]
			);
		} catch (e) {
			logger(e);
		}

		data.cardCount = cardCount;
		data.setTitle = setTitle;
		data.setReleaseDate = setReleaseDate;
		data.referer = URL_BASE + link;

		const pack_id = await insertPacks(db, {
			name: setTitle,
			release_date: setReleaseDate,
			card_count: cardCount,
			timeStamp: Date(),
			image_referer: URL_BASE + link,
		});

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
			return {
				pack_id,
				image: imgLink || null,
				name: cardName || null,
				attribute_type: cardAttr || null,
				trap_spell_effect: effectType || null,
				monster_level: cardLvl || null,
				monster_type: cardInfoSpecies || null,
				monster_atk: power?.atk?.split(" ")[1] || null,
				monster_def: power?.def?.split(" ")[1] || null,
				card_effect: cardEffect || null,
				created_on: Date() || null,
			};
		});
		// puppeteer .$eval() rejects if the css selector cannot be found...
		// thus we use Promise.allSettled vs .all so the entire collection does not reject
		return Promise.allSettled(cardDlPromises).then((results) => {
			data.cards = results.map((result) => {
				return result.value;
			});

			return db`insert into cards ${db(data.cards)}`.then((results) => {
				const end = Date.now();
				logger(
					getCardData.name,
					data.setTitle,
					"Took",
					(end - start) / 1000,
					"seconds"
				);
				logger(data.setTitle, "database done writing");
				return data.setTitle;
			});
		});
	} catch (e) {
		logger(e, data.setTitle);
	}
};

// get links to all booster, structure deck, etc. pages
const loadMainPage = async (getPackLinks, maxTabs) => {
	try {
		// load puppeteer headless browser
		const browser = await puppeteer.launch({
			headless: true,
		});
		const mainPage = await browser.newPage();
		await mainPage.goto(URL, { waitUntil: ["domcontentloaded"] });
		// make sure page loaded.
		logger(URL + " loaded...");
		const links = await getPackLinks(mainPage);
		// close mainPage
		await mainPage.close();
		// loop through all links/pages and run the scraper
		if (mainPage.isClosed()) {
			logger("its closed");
			await chunkLoad(maxTabs, links, browser);
			// await loadSubPage(links[6], browser);
			logger("Closing browser session...");
			await browser.close();
			await db.end();
		}
	} catch (e) {
		console.error(e);
		await browser.close();
	}
};

// load a new page for each link for efficiency?
const loadSubPage = async (url, browser) => {
	const start = Date.now();
	// undefined url
	if (!url) return;
	logger("Loading subpage for " + url);
	try {
		const subPage = await browser.newPage();
		await subPage.goto(URL_BASE + url, { waitUntil: ["domcontentloaded"] });
		const setName = await getCardData(subPage, url);
		// close sub page
		logger("Completed crawling: " + url);
		logger("Closing tab...");
		await subPage.close();
		const end = Date.now();
		logger(
			loadSubPage.name,
			setName,
			"Took",
			(end - start) / 1000,
			"seconds"
		);
	} catch (e) {
		logger("Error loading subpage...", e);
	}
};

// const chunk load tabs to prevent crash
const chunkLoad = async (maxTabs, links, browser) => {
	const linksLength = links.length;
	for (let i = 0; i < linksLength; i += maxTabs) {
		const start = Date.now();
		logger("Processing links: ", i, i + maxTabs - 1);
		const promises = [];
		for (j = i; j < i + maxTabs; j++) {
			promises.push(loadSubPage(links[j], browser));
		}
		// do not continue until this chunk of pages is done
		await Promise.allSettled(promises);
		const end = Date.now();
		logger(
			chunkLoad.name,
			"Chunks",
			i,
			"to",
			i + maxTabs - 1,
			"Took",
			(end - start) / 1000,
			"seconds"
		);
	}
};

// images on the site only come back if the referer header is the current url
// image comes back as an octet/stream
// colons do not throw an error but are invalid on windows. Causes empty files to be made.

loadMainPage(getPackLinks, 7);

module.exports = {
	loadMainPage,
	getPackLinks,
	loadSubPage,
};
