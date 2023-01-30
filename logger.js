const fs = require("fs");

const logger = (...args) => {
	console.log(...args);
	const content = args.join(" ");
	const timeStamp = new Date().toString();
	const data = JSON.stringify({ timeStamp, content });

	fs.appendFile("logs.txt", data + "\n", (err) => {
		if (err) console.log(err);
	});
};

// const data = new Date().toString();

// logger("hello");
// logger("Hello my name is phillip");
// logger("Hello", 1 + 1, "is", 1 + 1);
// logger("this is", data);

module.exports = logger;
