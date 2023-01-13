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
	const setTitle = await page.$eval(
		"#broad_title h1>strong",
		(title) => title.textContent
	);
	console.log(setTitle);
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
			loadSubPage(links[15], browser);
			loadSubPage(links[20], browser);
			loadSubPage(links[34], browser);
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
