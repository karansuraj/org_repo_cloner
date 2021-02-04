require("dotenv").config();
const fs = require('fs');
const _ = require('lodash');
const git = require('simple-git/promise');
const { Octokit } = require("@octokit/rest");


const fullListFile = 'lists/fullList.json';
const filteredListFile = 'lists/filteredList.json';
const leftoverListFile = 'lists/leftoverList.json';


/* ---------------------- File Ops Functions ---------------------- */
async function write(filename, data) {
  try {
    let jsonObj = JSON.stringify(data);
    fs.writeFileSync(filename, jsonObj);
    // console.log("Data written to " + filename + "!");
    return true;
  } catch(err) {
    logger.error("Error writing to file '"+filename+"'! => "+err);
    return false;
  }
}

async function read(filename) {
  try {
    let rawData = fs.readFileSync(filename);
    return JSON.parse(rawData);
  } catch(err) {
    logger.error("Error reading from file '"+filename+"'! => "+err);
    return null;
  }
}

/* ---------------------- Git Repo Clone Function ---------------------- */
// Clone repo to a directory from a git URL
async function gitClone(gitURL, directory) {
  // TODO: Handle promise better for git errors
  console.log('Cloning ' + gitURL + ' to '+directory);
  return git().clone(gitURL, directory).catch((err) => {
    console.error(err);
    // throw err;
  });
}


/* ---------------------- Git Octokit API Function ---------------------- */

const octokit = new Octokit({
  auth: process.env.GIT_AUTH_TOKEN,
  baseUrl: 'https://api.github.com'

});

async function getListOfRepos() {
  let fullList = [];

  let size = -1;
  let pageNum = 1;
  let url;
  // Iterate in pages of up to 100 records until there are no pages left
  while(size != 0) {
    let req = await octokit.request('GET /orgs/{org}/repos', {
      org: process.env.GIT_ORG,
      type: 'all',
      per_page: 100,
      page: pageNum
    })
    // console.log(req);
    size = _.size(req.data);

    for(let item in req.data) {
      url = req.data[item].html_url
      fullList.push(url);
      console.log(url);
    }
    // console.log(list1);
    console.log("Page Num: "+pageNum+", w/ "+size+" records.");
    pageNum++;
  }
  console.log("Total Repo Count: "+_.size(fullList));
  write(fullListFile, fullList);
}


/* ---------------------- Filter and Clone Repos ---------------------- */

async function filterList() {
  let repoList = await read(fullListFile);
  let regex = new RegExp(process.env.REPO_FILTER_REGEX);
  let filteredList = [];
  let leftoverList = [];
  console.log("Total Number of Repos: "+repoList.length);
  for(let item of repoList) {

    if(regex.test(item)) {
      // console.log(item);
      filteredList.push(item);
    } else {
      leftoverList.push(item)
    }
  }
  console.log("Total Number of Filtered Repos: "+filteredList.length);
  write(filteredListFile,filteredList);
  write(leftoverListFile,leftoverList);
}

async function cloneRepos() {
  let filteredList = await read(filteredListFile);
  let repoName;
  let lastSlash;
  let directory;

  for(let item of filteredList) {
    // console.log(item);
    lastSlash = item.lastIndexOf('/');
    repoName = item.substring(lastSlash+1);
    directory = 'repos/'+repoName;
    // console.log(directory);
    await gitClone(item, directory);
  }

}

async function getFilterNCloneRepos() {
  await getListOfRepos();
  await filterList();
  await cloneRepos();
}

getFilterNCloneRepos();
