import { jsx as _jsx, jsxs as _jsxs } from "hono/jsx/jsx-runtime";
import { Hono } from "hono";
import flatCache from "flat-cache";
import { nanoid } from "nanoid";
const app = new Hono();
const cache = flatCache.load("cacheId");
const View = (props) => {
    return (_jsx("html", {
        lang: "en",
        children: _jsx("body", {
            children: _jsxs("div", {
                class: "container",
                children: [
                    _jsx("h1", { children: "URL Shrinker" }),
                    _jsxs("form", {
                        action: "/shortUrls",
                        method: "POST",
                        class: "my-4 form-inline",
                        children: [
                            _jsx("label", {
                                for: "fullUrl",
                                class: "sr-only",
                                children: "Url",
                            }),
                            _jsx("input", {
                                required: true,
                                placeholder: "Url",
                                type: "url",
                                name: "fullUrl",
                                id: "fullUrl",
                                class: "form-control col mr-2",
                            }),
                            _jsx("button", {
                                class: "btn btn-success",
                                type: "submit",
                                children: "Shrink",
                            }),
                        ],
                    }),
                    _jsxs("table", {
                        class: "table table-striped table-responsive",
                        children: [
                            _jsx("thead", {
                                children: _jsxs("tr", {
                                    children: [
                                        _jsx("th", { children: "Full URL" }),
                                        _jsx("th", { children: "Short URL" }),
                                        _jsx("th", { children: "Clicks" }),
                                    ],
                                }),
                            }),
                            _jsx("tbody", {
                                children: Object.entries(props.shortUrls).map(
                                    (shortUrl) => {
                                        return (_jsxs("tr", {
                                            children: [
                                                _jsx("td", {
                                                    children: _jsx("a", {
                                                        href: shortUrl[1].full,
                                                        children:
                                                            shortUrl[1].full,
                                                    }),
                                                }),
                                                _jsx("td", {
                                                    children: _jsx("a", {
                                                        href: shortUrl[1].short,
                                                        children:
                                                            shortUrl[1].short,
                                                    }),
                                                }),
                                                _jsx("td", {
                                                    children:
                                                        shortUrl[1].clicks,
                                                }),
                                            ],
                                        }));
                                    },
                                ),
                            }),
                        ],
                    }),
                ],
            }),
        }),
    }));
};
app.get("/", (c) => {
    const urlObjects = cache.all();
    return c.html(_jsx(View, { shortUrls: urlObjects }));
});
app.post("/shortUrls", async (c) => {
    const body = await c.req.parseBody();
    const urlObject = {
        short: nanoid(10),
        full: body["fullUrl"],
        clicks: 0,
    };
    cache.setKey(urlObject.short, urlObject);
    cache.save(true);
    return c.redirect("/");
});
app.get("/:shortUrl", async (c) => {
    const urlObject = cache.getKey(c.req.param("shortUrl"));
    if (urlObject === null) {
        return c.notFound();
    }
    urlObject.clicks++;
    cache.setKey(urlObject.short, urlObject);
    cache.save(true);
    return c.redirect(urlObject.full);
});

if (typeof Deno !== "undefined") {
    console.log("Running on deno");
    Deno.serve({ port: 8080 }, app.fetch);
} else if (typeof Bun !== "undefined") {
    console.log("Running on bun");
} else {
    import("@hono/node-server").then(({ serve }) => {
        serve({ fetch: app.fetch, port: 8080 }, (info) => {
            console.log(`Listening on http://localhost:${info.port}`);
        });
    });
}

export default {
    port: 8080,
    fetch: app.fetch,
};
