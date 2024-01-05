const path = require('path')
const fs = require('fs')
const cp = require('child_process')
let bookmarksDataCache = null

function getBookmarks (dataDir, browser) {
  const profiles = ['Default', 'Profile 3', 'Profile 2', 'Profile 1']
  const profile = profiles.find(profile => fs.existsSync(path.join(dataDir, profile, 'Bookmarks')))
  if (!profile) return []
  const bookmarkPath = path.join(dataDir, profile, 'Bookmarks')
  const bookmarksData = []
  const icon = browser + '.png'
  try {
    const data = JSON.parse(fs.readFileSync(bookmarkPath, 'utf-8'))
    const getUrlData = (item, folder) => {
      if (!item || !Array.isArray(item.children)) return
      item.children.forEach(c => {
        if (c.type === 'url') {
          bookmarksData.push({
            addAt: parseInt(c.date_added),
            title: c.name || '',
            description: (folder ? '「' + folder + '」' : '') + c.url,
            url: c.url,
            browser,
            icon
          })
        } else if (c.type === 'folder') {
          getUrlData(c, folder ? folder + ' - ' + c.name : c.name)
        }
      })
    }
    getUrlData(data.roots.bookmark_bar, '')
    getUrlData(data.roots.other, '')
    getUrlData(data.roots.synced, '')
  } catch (e) {}
  return bookmarksData
}

function openUrlByChrome (url) {
  if (process.platform === 'win32') {
    const suffix = `${path.sep}Google${path.sep}Chrome${path.sep}Application${path.sep}chrome.exe`
    const prefixes = [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA].filter(Boolean)
    const prefix = prefixes.find(prefix => fs.existsSync(path.join(prefix, suffix)))
    const chromeApp = prefix && path.join(prefix, suffix)
    if (chromeApp) {
      cp.spawn(chromeApp, [url], { detached: true })
    } else {
      window.utools.shellOpenExternal(url)
    }
    return
  }
  if (process.platform === 'darwin') {
    const chromeApp = '/Applications/Google Chrome.app'
    if (fs.existsSync(chromeApp)) {
      cp.spawn('open', ['-a', chromeApp, url], { detached: true })
    } else {
      window.utools.shellOpenExternal(url)
    }
  }
}

function openUrlByEdge (url) {
  if (process.platform === 'win32') {
    const args = ['shell:AppsFolder\\Microsoft.MicrosoftEdge_8wekyb3d8bbwe!MicrosoftEdge']
    args.push(url)
    cp.spawn('start', args, { shell: 'cmd.exe', detached: true }).once('error', () => {
      window.utools.shellOpenExternal(url)
    })
    return
  }
  if (process.platform === 'darwin') {
    const edgeApp = '/Applications/Microsoft Edge.app'
    if (fs.existsSync(edgeApp)) {
      cp.spawn('open', ['-a', edgeApp, url], { detached: true })
    } else {
      window.utools.shellOpenExternal(url)
    }
  }
}

window.exports = {
  'bookmarks-search': {
    mode: 'list',
    args: {
      enter: (action, callbackSetList) => {
        bookmarksDataCache = []
        let chromeDataDir
        let edgeDataDir
        if (process.platform === 'win32') {
          chromeDataDir = path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data')
          edgeDataDir = path.join(process.env.LOCALAPPDATA, 'Microsoft/Edge/User Data')
        } else if (process.platform === 'darwin') {
          chromeDataDir = path.join(window.utools.getPath('appData'), 'Google/Chrome')
          edgeDataDir = path.join(window.utools.getPath('appData'), 'Microsoft Edge')
        } else { return }
        if (fs.existsSync(chromeDataDir)) {
          bookmarksDataCache.push(...getBookmarks(chromeDataDir, 'chrome'))
        }
        if (fs.existsSync(edgeDataDir)) {
          bookmarksDataCache.push(...getBookmarks(edgeDataDir, 'edge'))
        }
        if (bookmarksDataCache.length > 0) {
          bookmarksDataCache = bookmarksDataCache.sort((a, b) => a.addAt - b.addAt)
        }
      },
      search: (action, searchWord, callbackSetList) => {
        searchWord = searchWord.trim()
        if (!searchWord) return callbackSetList()
        if (/\S\s+\S/.test(searchWord)) {
          const regexTexts = searchWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(/\s+/)
          const searchRegexs = regexTexts.map(rt => new RegExp(rt, 'i'))
          return callbackSetList(bookmarksDataCache.filter(x => (
            !searchRegexs.find(r => x.title.search(r) === -1) || !searchRegexs.find(r => x.description.search(r) === -1)
          )))
        } else {
          const regexText = searchWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const searchRegex = new RegExp(regexText, 'i')
          return callbackSetList(bookmarksDataCache.filter(x => (
            x.title.search(searchRegex) !== -1 || x.description.search(searchRegex) !== -1
          )))
        }
      },
      select: (action, itemData) => {
        window.utools.hideMainWindow(false)
        if (itemData.browser === 'chrome') {
          openUrlByChrome(itemData.url)
        } else {
          openUrlByEdge(itemData.url)
        }
        window.utools.outPlugin()
      }
    }
  }
}
