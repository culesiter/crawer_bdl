const cheerio = require('cheerio');
const request = require('request-promise');
const fs = require('fs').promises;
const fs2 = require('fs-extra');
const ults = require('../ults/team');
const { v4: uuidv4 } = require('uuid');
const path = require('path'); 

async function handleLimit(req, res) {
    try {
        let currentProcessKey = 0;
        let needProcessId = 10;

        // Read and parse current process data
        try {
            const currentProcessData = await fs.readFile('json/process-data.json', 'utf8');
            const currentProcess = JSON.parse(currentProcessData);
            currentProcessKey = currentProcess?.current || currentProcessKey;
            needProcessId = currentProcessKey;
        } catch (err) {
            console.error("Error reading process data:", err);
        }

        if (req?.query?.limit) {
            const limit = parseInt(req.query.limit, 10);
            if (!isNaN(limit)) {
                needProcessId += limit;
            }
        }

        // Write updated process data
        try {
            await fs.writeFile('json/process-data.json', JSON.stringify({ current: needProcessId }));
        } catch (err) {
            console.error("Error writing process data:", err);
        }

        // Filter teams
        const filteredObj = Object.fromEntries(
            Object.entries(ults.FOOTBALL_TEAM_NAME).filter(
                ([key]) => key > currentProcessKey && key <= needProcessId
            )
        );

        return filteredObj;
    } catch (error) {
        console.error("Unexpected error:", error);
        return {};
    }
}

const handleData = async (data) => {
    try {
        let startPos = data.indexOf("lineupDetail");
        let endPos = data.indexOf("leagueData");
        if (startPos === -1 || endPos === -1 || startPos >= endPos) {
            console.log("Invalid data format: 'lineupDetail' or 'leagueData' not found.");
            return [];
        }
        
        let find = data.substring(startPos, endPos);
        
        let startPosSecond = find.indexOf("[[");
        let endPosSecond = find.indexOf("]]");
        if (startPosSecond === -1 || endPosSecond === -1 || startPosSecond >= endPosSecond) {
            console.log("Invalid data format: Array not found.");
            return [];
        }

        let arrayString = find.substring(startPosSecond, endPosSecond + 2);
        if (!arrayString) {
            console.log("Invalid data format: arrayString not found.");
            return [];
        } 
        let jsonString = arrayString.replace(/'/g, '"');
      
        if (!JSON.parse(jsonString)) {
            if (!arrayString) {
                console.log("Invalid data format cannot parse string: jsonString.");
                return [];
            }
        }
        let parsedArray = JSON.parse(jsonString);

        if (Array.isArray(parsedArray) && parsedArray.length) {
            let listPlayer = parsedArray.filter(el => el && el.length && el[1].trim()).map(el => ({
                id: el[0],
                name: el[2],
                name_second: el[3]
            }));
            return listPlayer;
        }
        return [];
    } catch (error) {
        console.error("Error processing data:", error);
        throw error;
    }
};


exports.crawers_2 = async (req, res) => { 
    const filteredObj = await handleLimit(req, res);
    const indxs = Object.keys(filteredObj);
    const promises = [];
    for (let index = 0; index < indxs.length; index++) {
        const element = indxs[index];
        promises.push(request(`https://football.bongdalu688.com/jsdata/teamInfo/teamdetail/tdl${element}_vn.js`));
    }
    const response = await Promise.allSettled(promises);
    console.log(new Date().toLocaleTimeString());
    if (response && response.length) {
        for (let index = 0; index < response.length; index++) {
            const element = response[index];
            if (!element.value) continue;
            const x = await handleData(element.value);
            if (!x || !x.length) continue;
            let newJson = JSON.stringify(x, null, "\t");
            await fs.writeFile('json/players/data_'+uuidv4()+'.json', newJson, { encoding: 'utf8' })
        }
    }
    res.send([1]);
};  


// exports.mergePlayers = async (req, res) => { 
//     try {
//         const mergedArray = mergeJsonFiles(jsonPattern);
//         const outputPath = path.join(__dirname,'..', 'json/merged/players_merged.json');
//         fs.writeFileSync(outputPath, JSON.stringify(mergedArray, null, 2), 'utf8');
//         res.send([`Merged JSON has been saved to ${outputPath}`]);
//     } catch (error) {
//         console.error('An error occurred:', error);
//     }
// };  

exports.mergeJsonFiles = (res, folderPath = './json/players') => {
    let mergedData = [];

    fs2.readdir(folderPath, (err, files) => {
        if (err) {
            return console.error('Unable to scan directory: ' + err);
        }

        let jsonFiles = files.filter(file => path.extname(file) === '.json');

        jsonFiles.forEach((file, index) => {
            const filePath = path.join(folderPath, file);
            fs2.readFile(filePath, 'utf-8', (err, data) => {
                if (err) {
                    console.error(`Error reading file ${file}: ${err}`);
                    return;
                }

                try {
                    const jsonData = JSON.parse(data);
                    if (Array.isArray(jsonData)) {
                        mergedData = mergedData.concat(jsonData);
                    } else {
                        console.warn(`File ${file} does not contain a JSON array`);
                    }
                } catch (parseErr) {
                    console.error(`Error parsing JSON from file ${file}: ${parseErr}`);
                }

                if (index === jsonFiles.length - 1) {
                    // Write the merged data to a new file once all files have been processed
                    const outputFilePath = path.join('./json/merged', 'merged_players.json');
                    fs2.writeFile(outputFilePath, JSON.stringify(mergedData, null, 2), 'utf-8', (writeErr) => {
                        if (writeErr) {
                            console.error(`Error writing output file: ${writeErr}`);
                            return;
                        }
                        console.log('Merged JSON array has been saved to', outputFilePath); 
                        res.send([`Merged JSON has been saved to ${outputFilePath}`]);

                    });
                }
            });
        });
    });
}
