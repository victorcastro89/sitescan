let Wappalyzer;

(async () => {
  Wappalyzer = (await import('./wappalyzer/src/drivers/npm/driver.js')).default;

  const url = ['http://fufasdasorte.com.br/','http://www.beerworld.com.br/']

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1', // Do Not Track Request
  };
  
  const storage = {
    local: {
      'userId': '12345',
      'theme': 'light',
      'sessionToken': 'abcde12345'
    },
    session: {
      'sessionStartTime': new Date().toISOString(),
      'viewedProducts': '[]'
    }
  };
  
  
    
    const options = {
      debug: false,
      delay: 0,
      headers: headers,
      maxDepth: 3,
      maxUrls: 10,
      maxWait: 20000,
      recursive: false,
      probe: true,
      proxy: false,
      userAgent: 'Wappalyzer',
      htmlMaxCols: 3000,
      htmlMaxRows: 3000,
      noScripts: false,
      noRedirect: false,
      storage:storage
    
    };
  const wappalyzer = new Wappalyzer(options)
  
  ;(async function() {
    try {
      await wappalyzer.init()
  
      // Optionally set additional request headers
      const headers = {}
  
      // Optionally set local and/or session storage
      const storage = {
        local: {}
     
      }
  
      const site = await wappalyzer.open(url[0], headers, storage)
  
      // Optionally capture and output errors
      // site.on('error', (x)=>console.log(x.message.code))
      try{
        const results = await site.analyze()
         console.log(JSON.stringify(results, null, 2))
        // console.log(results.technologies.length);
      }
catch(e){
   console.log(e);
}
  

    } catch (error) {
      console.error(error)
    }
  
    await wappalyzer.destroy()
  })()
})();

