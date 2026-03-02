// temporary setup since python's http.server serves the javascript incorrectly.
const express = require("express");
const app = new express();

app.use(express.static("./frontend/public/"))

app.listen(3621);