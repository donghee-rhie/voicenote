const {app} = require("electron"); console.log("app:", typeof app); app.on("ready", () => { console.log("ready"); setTimeout(() => app.quit(), 1000); });
