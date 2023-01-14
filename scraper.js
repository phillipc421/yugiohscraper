const puppeteer = require("puppeteer");

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
const getCardData = async (page) => {
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
		// cards info is in <dl class="flex_1"> tags
		data.cards = [];
		const cardDls = await page.$$("dl.flex_1");
		const cardDlPromises = cardDls.map(async (cardDl) => {
			const cardName = await cardDl.$eval(
				".card_name",
				(cardName) => cardName.textContent
			);
			console.log(cardName);
			const cardAttr = await cardDl.$eval(
				".box_card_attribute>span",
				(cardAttr) => cardAttr.textContent
			);
			console.log(cardAttr);
			let cardLvl;
			try {
				cardLvl = await cardDl.$eval(
					".box_card_level_rank.level>span",
					(cardLvl) => cardLvl.textContent
				);
			} catch (e) {}

			console.log(cardLvl);
			let cardInfoSpecies;
			try {
				cardInfoSpecies = await cardDl.$eval(
					".card_info_species_and_other_item>span",
					(info) =>
						info.textContent.slice(
							info.textContent.indexOf("["),
							info.textContent.indexOf("]")
						)
				);
			} catch (e) {}

			console.log(cardInfoSpecies);
			return {
				cardName,
				cardAttr,
				cardLvl,
				cardSpeciesType: cardInfoSpecies,
			};
		});
		Promise.allSettled(cardDlPromises).then((data) => console.log(data));
	} catch (e) {
		console.log(e);
	}
};

// get links to all booster, structure deck, etc. pages
const loadMainPage = async () => {
	try {
		// load puppeteer headless browser
		const browser = await puppeteer.launch();
		const mainPage = await browser.newPage();
		await mainPage.goto(URL, { waitUntil: ["domcontentloaded"] });
		// makle sure page loaded.
		console.log(URL + " loaded...");
		const links = await getPackLinks(mainPage);
		// close mainPage
		await mainPage.close();
		if (mainPage.isClosed()) {
			loadSubPage(links[10], browser);
		}
	} catch (e) {
		console.error(e);
	}
};

// load a new page for each link for efficiency?
const loadSubPage = async (url, browser) => {
	console.log("Loading subpage for " + url);
	const subPage = await browser.newPage();
	await subPage.goto(URL_BASE + url, { waitUntil: ["domcontentloaded"] });
	await getCardData(subPage);
};

loadMainPage();
