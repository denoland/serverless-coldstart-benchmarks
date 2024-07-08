import express from "express";
import flatCache from "flat-cache";
import { nanoid } from "nanoid";
import morgan from "morgan";
import responseTime from "response-time";
import cookieparser from "cookie-parser";
import compression from "compression";

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(morgan("tiny"));
app.use(responseTime());
app.use(cookieparser());
app.use(compression());
const cache = flatCache.load("cacheId");

app.get("/", async (req, res) => {
  const urlObjects = cache.all();
  res.render("index", { shortUrls: urlObjects });
});

app.post("/shortUrls", async (req, res) => {
  const urlObject = {
    short: nanoid(10),
    full: req.body.fullUrl,
    clicks: 0,
  };
  cache.setKey(urlObject.short, urlObject);
  cache.save(true);
  res.redirect("/");
});

app.get("/:shortUrl", async (req, res) => {
  const urlObject = cache.getKey(req.params.shortUrl);
  if (urlObject == null) return res.sendStatus(404);
  urlObject.clicks++;
  cache.setKey(urlObject.short, urlObject);
  cache.save(true);
  res.redirect(urlObject.full);
});

console.log("Listening on port 8080");
app.listen(8080);
