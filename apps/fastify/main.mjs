import Fastify from "fastify";
import fastifyView from "@fastify/view";
import fastifyFormBody from "@fastify/formbody";
import flatCache from "flat-cache";
import { nanoid } from "nanoid";
import ejs from "ejs";

const fastify = Fastify({
  logger: true,
});

fastify.register(fastifyView, {
  engine: {
    ejs: ejs,
  },
});

fastify.register(fastifyFormBody);

const cache = flatCache.load("cacheId");

// Declare a route
fastify.get("/", async (req, res) => {
  const urlObjects = cache.all();
  return res.view("index.ejs", { shortUrls: urlObjects });
});

fastify.post("/shortUrls", async (req, res) => {
  const urlObject = {
    short: nanoid(10),
    full: req.body.fullUrl,
    clicks: 0,
  };
  cache.setKey(urlObject.short, urlObject);
  cache.save(true);
  res.redirect("/");
});

fastify.get("/:shortUrl", async (req, res) => {
  const urlObject = cache.getKey(req.params.shortUrl);
  if (urlObject == null) return res.sendStatus(404);
  urlObject.clicks++;
  cache.setKey(urlObject.short, urlObject);
  cache.save(true);
  res.redirect(urlObject.full);
});

// Run the server!
try {
  await fastify.listen({ port: 8080 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
