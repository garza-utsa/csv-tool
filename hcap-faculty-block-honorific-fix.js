var csv = require('fast-csv');
const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
var tasks = [];
var writableStream = fs.createWriteStream("hcap/hcap-faculty-blocks-edited.csv");
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
const POST_URI = "/api/v1/edit";
const GET_URI_BASE = "/api/v1/read/block/HCAP-VPAA-ASC-HALSTORE/";
const stream = csv.format({quoteColumns: true});
stream.pipe(writableStream);
headerOutput = ["Last", "First", "Honorific", "Title", "Research", "Education", "Discipline", "Tag", "Email", "blockURI", "blockID", "uuid", "profileURI", "profileID"];
stream.write(headerOutput);
writableStream.on("finish", function(){ console.log("DONE!"); });

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

fs.createReadStream('hcap/hcap-honorifics.csv')
  .pipe(csv.parse({ headers: true }))
  .on('data', function(obj) {
    // console.log("parsing row: " + obj.id);
    //input CSV headers:
    //Last,First,Honorific,Title,Research,Education,Discipline,Tag,Email,blockURI,blockID,uuid,profileURI,profileID
    var parsedData = {
      last: obj.Last,
      first: obj.First,
      honorific: obj.Honorific,
      pageURI: obj.profileURI,
      blockURI: obj.blockURI
    }
    tasks.push(parsedData);
    // processEachTask(parsedData);
    // execSync('sleep 1'); // block process for 1 second.
  }).on("end", function() {
  /*
  Promise.all(tasks.map(processEachTask)).then(afterAllTasks);
  // async/await notation:
  // you must be in an "async" environement to use "await"
  */
  async function wrapper () {
    console.log("task count: " + tasks.length);

    for(let t of tasks) {
      await processEachTask(t);
      // execSync('sleep 1');
    }
  }
  // async function return a promise transparently
  wrapper();

  console.log("waiting for tasks");

  //new flow for edit
  //parse block uri and page uri from csv
  //read block from CAS
  //update block JSON with link to page uri
  //save edited block back to CAS
  function processEachTask(task, callback) {
    var displayName = task.first + " " + task.last;
    if (task.honorific != "") {
      displayName = displayName + ", " + task.honorific;
    }
    console.dir(task);
    //do GET block
    var getOptions = {
      hostname: CAS_HOST,
      port: CAS_PORT,
      path: GET_URI_BASE + task.blockURI,
      method: 'GET',
      headers: {
        'Content-Type': 'application/application/json',
        Authorization: ' Bearer ' + API_KEY
      }
    };
    if (CAS_PORT == 443) {
      getOptions.requestCert = false;
      getOptions.rejectUnauthorized = false;
    }
    var getResponse = "";
    console.log("GET OPTIONS: ");
    console.log(getOptions);
    const get = protocol.request(getOptions, res => {
      res.on('data', d => {
        var editedAsset = {};
        getResponse = getResponse + d;
      });
      res.on('end', function() {
        let responseObj = JSON.parse(getResponse);
        // process.stdout.write(d);
        if (responseObj.asset) {
          console.log("PERFORM EDIT");
          responseObj.asset.xhtmlDataDefinitionBlock.metadata.displayName = displayName;
          responseObj.asset.xhtmlDataDefinitionBlock.metadata.title = displayName;
          var editedAsset = { "asset": responseObj.asset }
          let postData = JSON.stringify(editedAsset);
          console.log("new edited asset:");
          console.log(postData);          
          //begin POST edit
          var postOptions = {
            hostname: CAS_HOST,
            port: CAS_PORT,
            path: POST_URI,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': postData.length,
              Authorization: ' Bearer ' + API_KEY
            }
          };
          if (CAS_PORT == 443) {
            postOptions.requestCert = false;
            postOptions.rejectUnauthorized = false;
          }
          console.log("POST OPTIONS:");
          console.dir(postOptions);
          var postResponse = "";
          const post = protocol.request(postOptions, res => {
            // console.log('status code: ' + res.statusCode);
            // console.log('headers:', res.headers);
            res.on('data', d => {
              postResponse = postResponse + d;
              let responseObj = JSON.parse(d);
                process.stdout.write(d);
                process.stdout.write('\n');
            });
          });
          post.on('error', (e) => {
            console.log("ERROR on POST" + postOptions.path);
            console.error(e);
          })
          post.write(postData);
          post.end();
        } else {
          console.log("ERROR encountered while GETing page" + getOptions.path);
          console.log(getOptions);
          console.log(getResponse);
        }
      });
      get.on('error', (e) => {
        console.log('error on GET');
        console.error(e);
      });
    });
    get.end();


    //edit block JSON

    //do POST block


    // let postData = JSON.stringify(payload);
    // console.log("computed JSON payload:");
    // console.log(postData);

    // //do POST
    // var postResponse = "";
    // var postOptions = {
    //   hostname: CAS_HOST,
    //   port: CAS_PORT,
    //   path: POST_URI,
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //     'Content-Length': postData.length,
    //     Authorization: ' Bearer ' + API_KEY
    //   }
    // };
    // if (CAS_PORT == 443) {
    //   postOptions.requestCert = false;
    //   postOptions.rejectUnauthorized = false;
    // }

    // // console.dir(postOptions);
    // const post = protocol.request(postOptions, res => {
    //   // console.log('status code: ' + res.statusCode);
    //   // console.log('headers:', res.headers);
    //   res.on('data', d => {
    //     postResponse = postResponse + d;
    //     let responseObj = JSON.parse(d);
    //       process.stdout.write(d);
    //       process.stdout.write('\t' + payload.asset.xhtmlDataDefinitionBlock.parentFolderPath + "\t" + payload.asset.xhtmlDataDefinitionBlock.name);
    //       process.stdout.write('\n');
    //       let assetID = responseObj.createdAssetId;
    //       //["Last", "First", "Title", "Research", "Education", "Discipline", "Tag", "Email", "CAS-URI", "CAS-ASSET-ID"];
    //       outputResult = [
    //         task.last,
    //         task.first,
    //         task.title,
    //         task.research,
    //         task.education,
    //         task.discipline,
    //         task.tag,
    //         task.email,
    //         payload.asset.xhtmlDataDefinitionBlock.parentFolderPath + "/" + payload.asset.xhtmlDataDefinitionBlock.name,
    //         assetID
    //       ];
    //       stream.write(outputResult);
    //   });
    // });
    // post.on('error', (e) => {
    //   console.log('error on POST');
    //   console.error(e);
    // })
    // post.write(postData);
    // post.end();
  }
  
  function saveSnippet(content, fpath) {
    var articleStream = fs.createWriteStream(fpath);
    articleStream.write(content.prettify());
    articleStream.end();
  }

  function afterAllTasks(err) {
    console.log("all promises complete");
  }
});
