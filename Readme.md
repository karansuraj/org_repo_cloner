# Overview
This is a NodeJS based script that allows you to get a list of and clone all repos that you have access to within a Github organization. **It requires that you have node installed.**


# Setup

1. With node installed on your machine run `npm install`


2. Create a `.env` file in the root folder with the following contents (fill in variables after each `=` sign accordingly). Since this is a token-based authentication, you will need to create a token for yourself in your Github profile. For the `GIT_ORG` a Github organization must be specified. For the `REPO_FILTER_REGEX`, you may put `*` if you don't have any filters to specify.

```
GIT_AUTH_TOKEN=
GIT_ORG=
REPO_FILTER_REGEX=
```


# Running

After setting up, you can run `node getRepos.js` and the following will happen:

1. A list of all repos will be generated in `lists/fullList.json`
2. A list of all repos filtered according to your `REPO_FILTER_REGEX` will be generated in `lists/filteredList.json`
3. A list of all repos cut out by your `REPO_FILTER_REGEX` filter will be generated in `lists/leftoverList.json`
4. All repos in `list/filteredList.json` will be cloned to the `repos/` folder.
5. All cloned repos in the `/repos` folder will be zipped and stored in the `/zippedRepos` folder.
