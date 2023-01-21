const puppeteer = require("puppeteer");
const scrapper = require("./scraper");

const goToMock = jest.fn(async () => {});
const isClosedMock = jest.fn(() => {}).mockReturnValue(true);
const pageCloseMock = jest.fn(async () => {});
const newPageMock = jest.fn(async (url, options) => {
	return {
		goto: goToMock,
		close: pageCloseMock,
		isClosed: isClosedMock,
	};
});
const mockBrowser = {
	newPage: newPageMock,
	close: jest.fn(),
};
const getPackLinksMock = jest.fn(async (page) => [
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
]);
const loadSubPageMock = jest.fn(async (link, browser) => {});

describe("loadMainPage()", () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		jest.spyOn(puppeteer, "launch").mockImplementation(async () => {
			return mockBrowser;
		});
	});

	it("should launch a new browser session", async () => {
		await scrapper.loadMainPage(getPackLinksMock, jest.fn());
		expect(puppeteer.launch).toBeCalled();
	});

	it("should launch a new page and navigate", async () => {
		const URL = "https://www.db.yugioh-card.com/yugiohdb/card_list.action";
		const options = { waitUntil: ["domcontentloaded"] };
		await scrapper.loadMainPage(getPackLinksMock, jest.fn());
		expect(newPageMock).toBeCalled();
		expect(goToMock).toBeCalledWith(URL, options);
	});

	it("should get all pack links", async () => {
		await scrapper.loadMainPage(getPackLinksMock, jest.fn());
		expect(getPackLinksMock).toBeCalledWith(await newPageMock());
	});

	it("should close the main page and load subpages", async () => {
		const testLink = "7";

		await scrapper.loadMainPage(getPackLinksMock, loadSubPageMock);
		expect(pageCloseMock).toBeCalled();
		expect(isClosedMock).toBeCalled();
		expect(loadSubPageMock).toBeCalledWith(testLink, mockBrowser);
	});

	it("should not load subpages if main page is open", async () => {
		isClosedMock.mockReturnValue(false);
		await scrapper.loadMainPage(getPackLinksMock, loadSubPageMock);
		expect(loadSubPageMock).not.toBeCalled();
	});
});
