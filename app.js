const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { suitableJsonOutput, writeExcel } = require('./utils')
const omitEmpty = require('omit-empty');
const pgp = require("pg-promise")();
const db = pgp("postgres://mehdi:mehdi@78.46.124.237:5433/digikala");  //digikala
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
// const cron = require('node-cron');
// const CronJob = require('cron').CronJob;
const os = require('os');
// var osUtils = require('os-utils');



// ============================================ checkMemoryUsage and getCpuUsagePercentage
function checkMemoryUsage() {
    const totalMemory = os.totalmem();
    const usedMemory = os.totalmem() - os.freemem();
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
     return memoryUsagePercent;
}

function getCpuUsagePercentage() {
     const cpus = os.cpus();
     let totalIdle = 0;
     let totalTick = 0;

     cpus.forEach(cpu => {
          for (let type in cpu.times) {
               totalTick += cpu.times[type];
          }
          totalIdle += cpu.times.idle;
     });

     return ((1 - totalIdle / totalTick) * 100); 
}


// ============================================ DB
async function removeUrl() {
     const existsQuery = `
        SELECT * FROM urls u 
        limit 1
    `
     const deleteQuery = `
          DELETE FROM urls 
          WHERE id=$1
     `
     try {
          const urlRow = await db.oneOrNone(existsQuery);
          if (urlRow) {
               await db.query(deleteQuery, [urlRow.id])
          }
          return urlRow;
     } catch (error) {
          console.log("we have no url", error);
     }
}

async function insertUrlToProblem(queryValues) {
     const query = `
          insert into problem ("url", "sku", "name")
          values ($1, $2, $3)
     `;

     try {
          const result = await db.oneOrNone(query, queryValues);
          return result;
     } catch (error) {
          console.log("Error in insertUrlToProblem :", error.message);
     }
}

async function insertUrlToVisited(queryValues) {
     const query = `
          insert into visited ("url", "sku", "name")
          values ($1, $2, $3)
     `;

     try {
          const result = await db.oneOrNone(query, queryValues);
          return result;
     } catch (error) {
          console.log("Error in insertUrlToVisited :", error.message);
     }
}


// ============================================ DB
async function downloadImages(imagesUrls, imagesDIR, uuid) {
    for (let i = 0; i < imagesUrls.length; i++) {
        try {
            
            const imageUrl = imagesUrls[i];
            const response = await fetch(imageUrl);
            if (response.status == 200) {

                const buffer = await response.buffer();
                let imageType = path.extname(imageUrl);
                if (!imageType) {
                    imageType = '.jpg'
                }
                const localFileName = `${uuid}-${i + 1}${imageType}`;
                const imageDir = path.normalize(
                        imagesDIR + "/" + localFileName
                );
                fs.writeFileSync(imageDir, buffer);
            }
        } catch (error) {
            console.log("Error In Download Images", error);
        }
    }
}


// ============================================ scrapSingleProduct
async function scrapSingleProduct(page, productURL, imagesDIR, documentsDir, insertQueryInput, sku, rowNumber = 1) {
     try {

          console.log(`======================== Start scraping : \n${productURL}\n`);
          await page.goto(productURL, { timeout:180000 });
  

          await delay(5000);

          const html = await page.content();
          const $ = await cheerio.load(html);
     
          // Download Images
          let imagesUrls = $('.styles_InfoSection__rightSection__PiYpa picture img')
               .map((i, img) =>
               $(img)
                    ?.attr("src")
                    ?.replace(/(_thumb[0-9]+)/g, "")
               )
               .get().map(url => {
               if (url?.includes('?')) {
                    const x = url.split("?")[0];
                    return x;
               }
               return url;
               });
          imagesUrls = Array.from(new Set(imagesUrls));
          await downloadImages(imagesUrls, imagesDIR, sku);
     
          
          await insertUrlToVisited(insertQueryInput);
          

     } catch (error) {
          console.log("Error In scrapSingleProduct in page.goto", error);
          await insertUrlToProblem(insertQueryInput)
          return null;
     }

}


// ============================================ Main
async function main() {
     let urlRow;
     let browser;
     let page;
     let insertQueryInput;
     try {
          const DATA_DIR = path.normalize(__dirname + "/digiKala");
          const IMAGES_DIR = path.normalize(DATA_DIR + "/images");
          const DOCUMENTS_DIR = path.normalize(DATA_DIR + "/documents");


          // Create SteelAlborz Directory If Not Exists
          if (!fs.existsSync(DATA_DIR)) { fs.mkdirSync(DATA_DIR); }
          if (!fs.existsSync(DOCUMENTS_DIR)) { fs.mkdirSync(DOCUMENTS_DIR); }
          if (!fs.existsSync(IMAGES_DIR)) { fs.mkdirSync(IMAGES_DIR); }

          // Lunch Browser
          console.log("Before create browser");
          browser = await puppeteer.launch({
               headless: false, // Set to true for headless mode, false for non-headless
               executablePath:
                    process.env.NODE_ENV === "production"
                         ? process.env.PUPPETEER_EXECUTABLE_PATH
                         : puppeteer.executablePath(),
               args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });


          page = await browser.newPage();
          await page.setViewport({
               width: 1920,
               height: 1080,
          });

         
          urlRow = await removeUrl();
          if (urlRow?.url) {
               insertQueryInput = [
                    urlRow.url ,
                    urlRow.sku ,
                    urlRow.name,
               ];
               await scrapSingleProduct(page, urlRow.url, IMAGES_DIR, DOCUMENTS_DIR, insertQueryInput ,urlRow?.sku);

               // if exists productInfo insert it to products


          }

     }
     catch (error) {
          console.log("Error In main Function", error);
          await insertUrlToProblem(insertQueryInput);
     }
     finally {
          // Close page and browser
          console.log("End");
          await page.close();
          await browser.close();
          await delay(1000);
     }
}


// ============================================ Job

// stopTime = 8000
// let job = new CronJob('*/3 * * * * *', async () => {
     
//      console.log("cron");
//      let usageMemory = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024); 
//      let memoryUsagePercentage = checkMemoryUsage();
//      let cpuUsagePercentage = await getCpuUsagePercentage();
 

//      if (usageMemory >= 13 || cpuUsagePercentage >= 90) {
//           console.log("=========================================");
//           console.log(`job stopped for ${stopTime} ms`);
//           job.stop();

//           setInterval(() => {
//                console.log(`Restarting cron job after ${stopTime} ms...`)
//                job.start();
//           }, stopTime)
//      } 


//      if (memoryUsagePercentage <= 80 && cpuUsagePercentage <= 85) {
//           main();
//           console.log("main");
//      }

// })

// job.start()

let usageMemory = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024); 
let memoryUsagePercentage = checkMemoryUsage();
let cpuUsagePercentage = getCpuUsagePercentage();

if (memoryUsagePercentage <= 85 && cpuUsagePercentage <= 80 && usageMemory <= 28) {
     main();
}
else {
     const status = `status:\n
     memory usage = ${usageMemory}
     percentage of memory usage = ${memoryUsagePercentage}
     percentage of cpu usage = ${cpuUsagePercentage}
     \n
     `
     console.log("main function does not run.\n");
     console.log(status);
}





