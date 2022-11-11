const express = require("express");
const {
  createProxyMiddleware,
  responseInterceptor
} = require("http-proxy-middleware");

const app = express();

const splitAndKeep = function (str, separator, method = "seperate") {
  const splitAndKeepCore = (str, separator, method = "seperate") => {
    if (method === "seperate") {
      str = str.split(new RegExp(`(${separator})`, "g"));
    } else if (method === "infront") {
      str = str.split(new RegExp(`(?=${separator})`, "g"));
    } else if (method === "behind") {
      str = str.split(new RegExp(`(.*?${separator})`, "g"));
      str = str.filter(function (el) {
        return el !== "";
      });
    }
    return str;
  }
  if (Array.isArray(separator)) {
    var parts = splitAndKeepCore(str, separator[0], method);
    for (var i = 1; i < separator.length; i++) {
      var partsTemp = parts;
      parts = [];
      for (var p = 0; p < partsTemp.length; p++) {
        parts = parts.concat(splitAndKeepCore(partsTemp[p], separator[i], method));
      }
    }
    return parts;
  } else {
    return splitAndKeepCore(str, separator, method);
  }
};

const wordsToUpperPlain = (str) => {
  const words = splitAndKeep(str, "[\\s,.:;`+|*<>]");
  if (!words || words.length === 1) {
    return str;
  }
  const newStr = words
    .map((w) => (w.trim().length >= 6 && w.indexOf("/") === -1 ? w.toUpperCase() : w))
    .join("");
  return newStr;
};

const customRouter = function (req) {
  if (req.originalUrl.indexOf("/egwapi/") >= 0) {
    return "https://api.egw.news";
  }
  return "https://egw.news/"; // protocol + host
};
app.get("/", (req, res) => res.redirect("/counterstrike/news"));
app.use(
  createProxyMiddleware({
    target: "https://egw.news/",
    changeOrigin: true,
    selfHandleResponse: true,
    onProxyRes: responseInterceptor(
      async (responseBuffer, proxyRes, req, res) => {
        let response = responseBuffer.toString("utf-8"); // convert buffer to string
        if (req.originalUrl.indexOf("/egwapi/") >= 0) {
          const data = JSON.parse(response);
          const wordsToUpperInObj = (data) => {
            if (!data) {
              return data;
            }
            if (typeof data === "string" && data && data.indexOf("/") !== 0) {
              return wordsToUpperPlain(data);
            }
            if (data instanceof Array) {
              return data.map((el) => wordsToUpperInObj(el));
            }
            if (typeof data === "object") {
              Object.keys(data).forEach((key) => {
                data[key] = wordsToUpperInObj(data[key]);
              });
            }
            return data;
          };
          wordsToUpperInObj(data);
          response = JSON.stringify(data);
          return response;
        }
        if (response.indexOf("https://api.egw.news") >= 0) {
          return response.replace(/https:\/\/api\.egw\.news/g, "/egwapi");
        }
        return responseBuffer; // manipulate response and return the result
      }
    ),
    router: customRouter,
    pathRewrite: {
      "^/egwapi/": "/" // remove base path
    }
  })
);

app.listen(3000);
