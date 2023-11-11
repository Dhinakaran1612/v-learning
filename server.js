const express = require("express");
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");

const app = express();
const port = 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Route to scrape the page and serve the JSON file
app.get("/scrape", async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const url = `https://news.ycombinator.com/?p=${page}`;
    const scrapedData = await scrapePage(url);
    res.json(scrapedData);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

// Route to serve the JSON file
app.get("/results", (req, res) => {
  const filePath = path.join(__dirname, "results.json");

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    // Read the file and send it as a response
    const fileContent = fs.readFileSync(filePath, "utf8");
    res.json(JSON.parse(fileContent));
  } else {
    // If the file does not exist, send a 404 response
    res.status(404).send("File not found");
  }
});

// Function to scrape the page
async function scrapePage(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Wait for potential dynamic content
    await page.waitForSelector("tr.athing");

    const results = {
      "0-100": [],
      "101-200": [],
      "201-300": [],
      "301-n": [],
    };

    const newsItems = await page.$$("tr.athing");

    for (const item of newsItems) {
      // Additional logging for troubleshooting
      const newsItemHTML = await page.evaluate(
        (element) => element.outerHTML,
        item
      );
      //    console.log("News Item HTML:", newsItemHTML);

      // Wait for the title selector within each news item
      const titleElementHandle = await item.$("td.title a");

      if (titleElementHandle) {
        // Evaluate the title element in the browser context
        const title = await page.evaluate(
          (element) => element.textContent.trim(),
          titleElementHandle
        );       

         const subtextElement = await item.evaluateHandle(
           (el) => el.nextElementSibling
         );

         if (subtextElement) {
           // Evaluate JavaScript in the browser context to find the comments element
           const commentsElement = await subtextElement.$(
             'a[href*="item?id="]'
           );

           // Extract the number of comments
           const comments = commentsElement
             ? parseInt(
                 await commentsElement.evaluate(
                   (node) => node.textContent.split(" ")[0]
                 )
               )
             : 0;

           if (comments >= 0 && comments <= 100) {
             results["0-100"].push({ title, comments });
           } else if (comments >= 101 && comments <= 200) {
             results["101-200"].push({ title, comments });
           } else if (comments >= 201 && comments <= 300) {
             results["201-300"].push({ title, comments });
           } else {
             results["301-n"].push({ title, comments });
           }
         } else {
           console.log("Subtext element not found for the current news item.");
         }
      } else {
        console.log("Title element not found for the current news item.");
      }
    }

    // Write results to a JSON file
    fs.writeFileSync("results.json", JSON.stringify(results, null, 2));
    return results;
  } catch (error) {
    console.error("Error during scraping:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
