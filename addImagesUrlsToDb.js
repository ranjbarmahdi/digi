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
const os = require('os');

const jsonFiles = fs.readdirSync('./jsonFiles');


async function inserUrl(queryValues) {
     const query = `
          insert into urls ("url", "sku", "name")
          values ($1, $2, $3)
     `;

     try {
          const result = await db.oneOrNone(query, queryValues);
          return result;
     } catch (error) {
          console.log("Error in inserUrl :", error.message);
     }
}


async function main() {

    for (let i = 0; i < jsonFiles.length; i++){
        try { 
            const jsonFileName = jsonFiles[i];
            const jsonFilePath = path.join(__dirname, './jsonFiles', jsonFileName)
            console.log(`${jsonFileName} ========= ${i+1} from ${jsonFiles.length}`);
            const jsonFile = require(jsonFilePath);
            
            for (let j = 0; j < jsonFile.length; j++){
                try {
                    const product = jsonFile[j];
                    const url = product?.URL || '';
                    const sku = product?.SKU || '';
                    const name = product?.title || '';
                    const queryInput = [url, sku, name];
                    
                    if (sku && url) {
                        // inserting query
                        await inserUrl(queryInput)
                        await delay(200);
                    }
                } catch (error) {
                    console.log("Error in inner for loop");
                }
            }
        }
        catch {
            console.log("Erro in outer for loop");
        }

    }
}

main()