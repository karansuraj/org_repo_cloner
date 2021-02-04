require("dotenv").config();
const fs = require('fs-extra');
const _ = require('lodash');
const git = require('simple-git/promise');
const { Octokit } = require("@octokit/rest");
const archiver = require('archiver');


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
    console.error("Error writing to file '"+filename+"'! => "+err);
    return false;
  }
}

async function read(filename) {
  try {
    let rawData = fs.readFileSync(filename);
    return JSON.parse(rawData);
  } catch(err) {
    console.error("Error reading from file '"+filename+"'! => "+err);
    return null;
  }
}

// Return a list of files from the directory 'srcPath'
async function getDirFiles(srcPath) {
  let files;
  console.log('Reading directory: '+srcPath);
  try {
    files = fs.readdirSync(srcPath);
  } catch(err) {
    console.error('Failed to read directory '+srcPath+' ==> ', err);
    throw err;
  }
  return files;
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


/* ---------------------- Archiver Function ---------------------- */

async function zipAFolder(sourceDirectory, zipDirectory, filename) {
  // create a file to stream archive data to.
  let zipFilename = zipDirectory+'/'+filename+'.zip'
  const output = fs.createWriteStream(__dirname + zipFilename);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', function() {
    console.log(zipFilename+' written to with '+archive.pointer() + ' total bytes');
    // console.log('archiver has been finalized and the output file descriptor has closed.');
  });

  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      // log warning
      console.error("No such file or directory!");
    } else {
      // throw error
      console.error(err);
      throw err;
    }
  });

  // good practice to catch this error explicitly
  archive.on('error', function(err) {
    console.error(err);
    throw err;
  });

  // pipe archive data to the file
  archive.pipe(output);

  // append files from a sub-directory, putting its contents at the root of archive
  archive.directory(sourceDirectory+'/', false);

  // finalize the archive (ie we are done appending files but streams have to finish yet)
  // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
  archive.finalize();
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


/* ---------------------- Filter Clone, and Zip Repos ---------------------- */

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

async function zipRepos() {
  let repoDir = __dirname+'/repos';
  // Get list of repos
  let repos = await getDirFiles(repoDir);
  // Loop repos, zipping each one up to the /zippedRepos folder
  for(let repoName of repos) {
    if(repoName !== '.placeholder') {
      await zipAFolder(repoDir+'/'+repoName,'/zippedRepos',repoName);
    }
  }
}





async function getFilterNCloneRepos() {
  await getListOfRepos();
  await filterList();
  await cloneRepos();
  await zipRepos();
}

getFilterNCloneRepos();
